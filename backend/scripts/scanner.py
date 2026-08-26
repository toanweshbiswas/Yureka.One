import os
import sys
import json
import re
import io
import base64
import pickle
from datetime import datetime
from email.utils import parsedate_to_datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from bs4 import BeautifulSoup
from pypdf import PdfReader

SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/user.phonenumbers.read',
    'https://www.googleapis.com/auth/user.birthday.read',
    'https://www.googleapis.com/auth/user.gender.read',
    'https://www.googleapis.com/auth/user.addresses.read'
]

def calculate_age(birthday_dict):
    if not birthday_dict:
        return "N/A"
    year = birthday_dict.get('year')
    month = birthday_dict.get('month')
    day = birthday_dict.get('day')
    if not year or not month or not day:
        return "N/A"
    today = datetime.today()
    try:
        birth_date = datetime(year, month, day)
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return int(age)
    except Exception:
        return "N/A"

def fetch_user_profile(people_service, first_name_fallback, last_name_fallback, dob_fallback, gender_fallback, phone_fallback, location_fallback=''):
    try:
        profile = people_service.people().get(
            resourceName='people/me',
            personFields='names,phoneNumbers,birthdays,genders,emailAddresses,addresses'
        ).execute()
    except Exception as e:
        sys.stderr.write(f"People API warning: {str(e)}\n")
        profile = {}

    first_name, last_name = first_name_fallback, last_name_fallback
    names = profile.get('names', [])
    if names:
        first_name = names[0].get('givenName', first_name_fallback)
        last_name = names[0].get('familyName', last_name_fallback)
        
    gender = gender_fallback
    genders = profile.get('genders', [])
    if genders:
        gender = genders[0].get('formattedValue', gender_fallback)
        
    email = None
    emails = profile.get('emailAddresses', [])
    for em in emails:
        val = em.get('value')
        if val:
            email = val
            break
        
    dob_string, age = dob_fallback, "N/A"
    birthdays = profile.get('birthdays', [])
    if birthdays:
        date_data = birthdays[0].get('date', {})
        if date_data:
            day = date_data.get('day', '')
            month = date_data.get('month', '')
            year = date_data.get('year', '')
            dob_string = f"{day:02d}/{month:02d}/{year}" if year else f"{day:02d}/{month:02d}"
            age = str(calculate_age(date_data))
    elif dob_fallback:
        parts = dob_fallback.split('-')
        if len(parts) == 3:
            dob_string = f"{parts[2]}/{parts[1]}/{parts[0]}"
            try:
                birth = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                today = datetime.today()
                computed_age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                age = str(int(computed_age))
            except Exception:
                pass

    found_numbers = []
    phone_numbers = profile.get('phoneNumbers', [])
    for p in phone_numbers:
        val = p.get('value') or p.get('canonicalForm')
        if val and val not in found_numbers:
            found_numbers.append(val)

    try:
        directory_res = people_service.people().get(
            resourceName='people/me',
            personFields='metadata'
        ).execute()
        source_id = directory_res.get('metadata', {}).get('sources', [{}])[0].get('id')
        if source_id:
            batch_res = people_service.people().batchGet(
                resourceNames=[f'people/{source_id}'],
                personFields='phoneNumbers'
            ).execute()
            responses = batch_res.get('responses', [])
            if responses:
                deep_person = responses[0].get('person', {})
                deep_phones = deep_person.get('phoneNumbers', [])
                for dp in deep_phones:
                    dval = dp.get('value') or dp.get('canonicalForm')
                    if dval and dval not in found_numbers:
                        found_numbers.append(dval)
    except Exception:
        pass

    mobile_number = " | ".join(found_numbers) if found_numbers else phone_fallback

    location = location_fallback
    addresses = profile.get('addresses', [])
    if addresses:
        addr = addresses[0]
        location = addr.get('formattedValue') or ", ".join(
            filter(None, [addr.get('city'), addr.get('region'), addr.get('country')])
        ) or location_fallback

    return {
        'name': f"{first_name} {last_name}".strip(),
        'email': email,
        'dob': dob_string,
        'age': age,
        'gender': gender,
        'phone': mobile_number,
        'location': location
    }

def get_local_gmail_service():
    """Manages the OAuth 2.0 lifecycle using a local Desktop Client context."""
    paths_to_try_token = [
        'components/token.pickle',
        'token.pickle',
        '/Users/anweshbiswas/Yureka.Money/components/token.pickle',
        '/Users/anweshbiswas/Yureka.Money/token.pickle'
    ]
    paths_to_try_creds = [
        'components/credentials.json',
        'credentials.json',
        '/Users/anweshbiswas/Yureka.Money/components/credentials.json',
        '/Users/anweshbiswas/Yureka.Money/credentials.json'
    ]
    
    token_path = None
    for p in paths_to_try_token:
        if os.path.exists(p):
            token_path = p
            break
            
    creds_path = None
    for p in paths_to_try_creds:
        if os.path.exists(p):
            creds_path = p
            break
            
    write_token_path = token_path or 'components/token.pickle'
    
    creds = None
    if token_path and os.path.exists(token_path):
        with open(token_path, 'rb') as token:
            creds = pickle.load(token)
            
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                with open(write_token_path, 'wb') as token:
                    pickle.dump(creds, token)
            except Exception as refresh_err:
                raise Exception(f"Local token refresh failed: {str(refresh_err)}")
        else:
            raise Exception("Local desktop OAuth credentials expired or invalid. Re-authorization required.")
            
    return build('gmail', 'v1', credentials=creds)

def robust_urlsafe_b64decode(data):
    try:
        b_data = data.encode('ascii', errors='ignore')
        b_data = b_data.replace(b'-', b'+').replace(b'_', b'/')
        padding = len(b_data) % 4
        if padding:
            b_data += b'=' * (4 - padding)
        return base64.b64decode(b_data)
    except Exception as e:
        sys.stderr.write(f"Base64 urlsafe decode error: {str(e)}\n")
        return b""

def extract_all_body_and_attachments(service, message_id, payload):
    html_text = ""
    pdf_text = ""
    stack = [payload]
    
    while stack:
        current_part = stack.pop()
        mime_type = current_part.get('mimeType', '')
        filename = current_part.get('filename', '')
        
        if 'parts' in current_part:
            stack.extend(current_part['parts'])
            continue
            
        if mime_type in ['text/plain', 'text/html'] and not filename:
            data = current_part.get('body', {}).get('data', '')
            if data:
                try:
                    decoded_bytes = robust_urlsafe_b64decode(data)
                    decoded_str = decoded_bytes.decode('utf-8', errors='ignore')
                    html_text += " " + decoded_str
                except Exception as e:
                    sys.stderr.write(f"MIME body decode error: {str(e)}\n")
                    
        elif filename.lower().endswith('.pdf') or mime_type == 'application/pdf':
            attachment_id = current_part.get('body', {}).get('attachmentId')
            if attachment_id:
                try:
                    attachment = service.users().messages().attachments().get(
                        userId='me', messageId=message_id, id=attachment_id
                    ).execute()
                    file_data = robust_urlsafe_b64decode(attachment['data'])
                    
                    pdf_io = io.BytesIO(file_data)
                    reader = PdfReader(pdf_io)
                    for page in reader.pages:
                        extracted = page.extract_text()
                        if extracted:
                            pdf_text += extracted + "\n"
                except Exception as e:
                    sys.stderr.write(f"PDF extraction error: {str(e)}\n")
                    
    return html_text, pdf_text

def parse_transaction_data_expense(combined_text, sender, subject):
    sender_lower = sender.lower()
    subject_lower = subject.lower()
    brand_name = re.sub(r'\s*<.*?>', '', sender).replace('"', '').replace("'", "").strip()
    corpus_lower = f"{subject_lower}\n{combined_text.lower()}"

    is_transit_status = any(k in subject_lower or k in combined_text.lower() for k in [
        "packed", "out for delivery", "reached your city", "arriving early",
        "has been delivered", "shipment update", "tracking number",
    ]) and not any(k in corpus_lower for k in ["invoice", "amount paid", "order total", "grand total", "debited"])

    amount = "N/A"
    normalized_text = re.sub(r'\s+', ' ', combined_text)

    # Strong transaction intent — prefer these over loose currency matches
    strong_txn = any(k in corpus_lower for k in [
        'debited', 'spent', 'withdrawn', 'charged', 'txn of', 'transaction of',
        'payment successful', 'paid successfully', 'order confirmed', 'order placed',
        'upi ref', 'upi-', 'neft', 'imps', 'rtgs', 'a/c', 'acct', 'account xx',
        'transaction value', 'amount paid', 'grand total', 'invoice total',
        'you paid', 'payment of', 'purchased',
        'units allotted', 'units allocated', 'order executed', 'sip successful',
        'sip instalment', 'sip installment', 'amount invested', 'shares bought',
        'equity delivery', 'investment of', 'folio',
        'you invested', 'successfully invested', 'sip processed', 'sip done',
        'purchase of', 'allotment', 'redeemed', 'redemption',
    ])

    investment_senders = (
        'groww', 'zerodha', 'kite', 'upstox', 'angelone', 'angelbroking', 'angel one',
        'kuvera', 'smallcase', 'indmoney', 'etmoney', 'paytmmoney', 'paytm money',
        'hdfcsec', 'hdfc securities', 'icicidirect', 'icici direct', '5paisa',
        'motilal', 'coin.zerodha', 'nsdl', 'cdsl', 'camsonline', 'kfintech',
        'mfcentral', 'fyers', 'aliceblue', 'sharekhan', 'iifl', 'sbimf', 'axismf',
        'hdfcfund', 'icicipru', 'nippon', 'mirae', 'paragparikh', 'growwmail',
        'zrdha', 'zerodhabroking',
    )
    is_investment_mail = any(k in sender_lower for k in investment_senders) or any(
        k in subject_lower for k in (
            'units allotted', 'units allocated', 'order executed', 'sip successful',
            'sip instalment', 'sip installment', 'mutual fund', 'shares bought',
            'equity delivery', 'you invested', 'successfully invested', 'sip processed',
            'amount invested', 'systematic investment',
        )
    ) or any(
        k in corpus_lower for k in (
            'groww.in', 'zerodha.com', 'kite.trade', 'upstox.com', 'angelone.in',
        )
    )

    if "eatclub" in sender_lower:
        match = re.search(
            r'(?:Online Paid|Grand Total|Total|Sub Total)[:\s]*[₹Rs\.?]*\s*([\d,]+\.\d{2})',
            normalized_text, re.IGNORECASE,
        )
        if match:
            amount = f"₹ {match.group(1)}"

    elif "namecheap" in sender_lower:
        match = re.search(
            r'(?:Total|Charged|Amount)[:\s]*(?:US\s*\||\$)\s*([\d,]+\.\d{2})',
            normalized_text, re.IGNORECASE,
        )
        if match:
            amount = f"$ {match.group(1)}"

    elif any(k in sender_lower for k in ("phonepe", "paytm", "googlepay", "gpay", "amazon pay", "bhim")):
        match = re.search(
            r'(?:Transaction Value|Amount Paid|Amount|Paid|Debited|Txn Amount)[:\s]*[₹Rs\.?INR]*\s*([\d,]+(?:\.\d{1,2})?)',
            normalized_text, re.IGNORECASE,
        )
        if match:
            amount = f"₹ {match.group(1)}"

    elif 'cred' in sender_lower:
        # CRED sends editorials with example ₹ figures — only accept real payments
        if is_marketing_or_content_email(subject, '', combined_text, sender):
            return brand_name, "N/A", "N/A"
        if not re.search(
            r'\b(bill\s+paid|payment\s+(?:successful|received|done|of)|debited|'
            r'emi\s+(?:paid|of)|cleared|settled|txn|transaction\s+(?:of|alert)|'
            r'amount\s+(?:paid|due)|outstanding)\b',
            corpus_lower,
            re.IGNORECASE,
        ):
            return brand_name, "N/A", "N/A"
        match = re.search(
            r'(?:debited|paid|payment(?:\s+of)?|bill(?:\s+amount)?|emi(?:\s+of)?|'
            r'amount(?:\s+paid)?|outstanding)[:\s]*[₹Rs\.?INR]*\s*([\d,]+(?:\.\d{1,2})?)',
            normalized_text, re.IGNORECASE,
        )
        if match and _is_plausible_amount(match.group(1)):
            amount = f"₹ {match.group(1)}"

    elif any(k in sender_lower for k in (
        "axis", "hdfc", "icici", "sbi", "kotak", "yes bank", "yesbank",
        "indusind", "idfc", "bob", "pnb", "canara", "union bank",
    )):
        match = re.search(
            r'(?:debited(?:\s+for|\s+by|\s+with)?|spent|txn(?:\s+of)?|transaction(?:\s+of)?|'
            r'amount of|INR|Rs\.?|₹)\s*(?:of\s*)?(?:INR|Rs\.?|₹)?\s*([\d,]+\.?\d{0,2})',
            normalized_text, re.IGNORECASE,
        )
        if match:
            amount = f"₹ {match.group(1)}"

    elif "shiprocket" in sender_lower:
        match = re.search(
            r'(?:Invoice Total|Amount Paid|Total Amount|Paid Total)[:\s]*[₹Rs\.?]*\s*\b(\d+(?:\.\d{2})?)\b',
            normalized_text, re.IGNORECASE,
        )
        if match:
            amount = f"₹ {match.group(1)}"
        elif is_transit_status:
            return brand_name, "N/A", "N/A"

    elif any(k in sender_lower for k in (
        "swiggy", "zomato", "amazon", "flipkart", "myntra", "nykaa",
        "blinkit", "zepto", "bigbasket", "uber", "ola", "makemytrip", "bookmyshow",
    )):
        match = re.search(
            r'(?:Grand Total|Order Total|Total Paid|Amount Paid|Total Amount|You paid|'
            r'Paid successfully|Invoice Total|Net Payable)[:\s]*[₹Rs\.?INR]*\s*([\d,]+(?:\.\d{1,2})?)',
            normalized_text, re.IGNORECASE,
        )
        if match:
            amount = f"₹ {match.group(1)}"

    elif is_investment_mail:
        invest_patterns = [
            r'(?:you\s+invested|successfully\s+invested|amount(?:\s+invested)?|investment(?:\s+amount)?|'
            r'order(?:\s+value)?|total(?:\s+amount)?|trade(?:\s+value)?|debited|paid|'
            r'sip(?:\s+(?:of|amount|instalment|installment))?|purchase(?:\s+amount)?|'
            r'invested(?:\s+amount)?|value)[:\s]*[₹Rs\.?INR]*\s*([\d,]+(?:\.\d{1,2})?)',
            r'(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:was\s+)?(?:invested|debited|paid|allotted)',
            r'(?:sip\s+of|invested)\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)',
        ]
        for pattern in invest_patterns:
            match = re.search(pattern, normalized_text, re.IGNORECASE)
            if match and _is_plausible_amount(match.group(1)):
                if not _looks_like_promo_amount(normalized_text, match.start(), match.end()):
                    amount = f"₹ {match.group(1)}"
                    break
        if amount == "N/A":
            match = re.search(
                r'(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)',
                normalized_text, re.IGNORECASE,
            )
            if match and _is_plausible_amount(match.group(1)):
                if not _looks_like_promo_amount(normalized_text, match.start(), match.end()):
                    amount = f"₹ {match.group(1)}"
        # Normalize brand for planning category / UI
        for label, needles in (
            ('Groww', ('groww',)),
            ('Zerodha', ('zerodha', 'kite', 'zrdha')),
            ('Upstox', ('upstox',)),
            ('Angel One', ('angelone', 'angelbroking', 'angel one')),
            ('INDMoney', ('indmoney',)),
            ('ET Money', ('etmoney',)),
            ('Kuvera', ('kuvera',)),
            ('Smallcase', ('smallcase',)),
            ('Paytm Money', ('paytmmoney', 'paytm money')),
            ('HDFC Securities', ('hdfcsec', 'hdfc securities')),
            ('ICICI Direct', ('icicidirect', 'icici direct')),
            ('Coin', ('coin.zerodha', 'coin by zerodha')),
        ):
            if any(n in sender_lower or n in subject_lower or n in corpus_lower for n in needles):
                brand_name = label
                break

    if amount == "N/A" and not is_transit_status:
        # Priority 1: debit / spent phrasing (real money movement)
        debit_patterns = [
            r'(?:debited|spent|withdrawn|charged|txn(?:\s+of)?|transaction(?:\s+of)?|'
            r'paid(?:\s+successfully)?|amount of|payment of|you paid)\s+'
            r'(?:for|to|with|of|by|at)?\s*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+\.?\d{0,2})',
            r'(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d{0,2})\s*(?:was\s+)?(?:debited|spent|charged|paid)',
        ]
        for pattern in debit_patterns:
            for match in re.finditer(pattern, normalized_text, re.IGNORECASE):
                val = match.group(1)
                if _looks_like_promo_amount(normalized_text, match.start(), match.end()):
                    continue
                if _is_plausible_amount(val):
                    amount = f"₹ {val}"
                    break
            if amount != "N/A":
                break

        # Priority 2: order/invoice totals — only with strong txn intent
        if amount == "N/A" and strong_txn:
            total_patterns = [
                r'(?:grand total|order total|amount paid|total paid|invoice total|net payable)'
                r'[:\s]*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+\.?\d{0,2})',
            ]
            for pattern in total_patterns:
                match = re.search(pattern, normalized_text, re.IGNORECASE)
                if match and _is_plausible_amount(match.group(1)):
                    if not _looks_like_promo_amount(normalized_text, match.start(), match.end()):
                        amount = f"₹ {match.group(1)}"
                        break

        # Priority 3: bare currency — only for trusted bank/UPI senders, never promo context
        if amount == "N/A" and _is_trusted_financial_sender(sender) and strong_txn:
            bare = re.search(r'(?:₹|Rs\.?|INR)\s*([\d,]+\.\d{2})', normalized_text, re.IGNORECASE)
            if bare and _is_plausible_amount(bare.group(1)):
                if not _looks_like_promo_amount(normalized_text, bare.start(), bare.end()):
                    amount = f"₹ {bare.group(1)}"

    # Bank/UPI debit narratives that name a broker (GROWW / ZERODHA / …)
    if amount != "N/A" and not is_investment_mail:
        for label, needles in (
            ('Groww', ('groww',)),
            ('Zerodha', ('zerodha', 'kite', 'zrdha')),
            ('Upstox', ('upstox',)),
            ('Angel One', ('angelone', 'angel one')),
            ('INDMoney', ('indmoney',)),
            ('ET Money', ('etmoney',)),
            ('Kuvera', ('kuvera',)),
            ('Smallcase', ('smallcase',)),
            ('Paytm Money', ('paytmmoney', 'paytm money')),
            ('Coin', ('coin by zerodha', 'coin.zerodha')),
        ):
            if any(n in corpus_lower for n in needles):
                brand_name = label
                is_investment_mail = True
                break

    item_details = "N/A"
    if "eatclub" in sender_lower and "product details" in combined_text.lower():
        lines = combined_text.split('\n')
        captured = []
        start_cap = False
        for line in lines:
            if any(k in line.lower() for k in ["product details", "item description"]):
                start_cap = True
                continue
            if start_cap:
                if any(k in line.lower() for k in ["sub total", "total", "customer details", "order information"]):
                    break
                cleaned = re.sub(r'\s+', ' ', line).strip()
                if cleaned and not cleaned.replace('.', '').isdigit() and len(cleaned) > 3:
                    if not any(x in cleaned.lower() for x in ["qty", "rate", "amount"]):
                        captured.append(cleaned)
        if captured:
            item_details = " | ".join(captured[:3])

    if item_details == "N/A":
        subject_cleaned = re.sub(
            r'(Order Confirmed:|Your order|Invoice for|Receipt for|Your delivery from|'
            r'Your purchase|Confirmed|Booking|#\d+|\d+)',
            '', subject, flags=re.IGNORECASE,
        ).strip()
        if len(subject_cleaned) > 5 and not any(
            x in subject_cleaned.lower() for x in ['successful', 'payment', 'thank you', 'alert']
        ):
            item_details = subject_cleaned
        else:
            item_details = subject.strip()

    # Tag investments so planning always maps Groww/Zerodha/etc. → Investment
    if is_investment_mail and amount != "N/A":
        if 'investment' not in item_details.lower() and 'sip' not in item_details.lower():
            item_details = f"investment · {item_details}"

    return brand_name, amount, item_details


def _is_plausible_amount(val: str) -> bool:
    try:
        n = float(str(val).replace(',', ''))
    except Exception:
        return False
    # Skip trivial / placeholder amounts that are usually footer noise
    if n < 5:
        return False
    if n > 5_000_000:
        return False
    return True


def _looks_like_promo_amount(text: str, start: int, end: int) -> bool:
    """True when the matched rupee figure sits in marketing copy, not a debit."""
    window = text[max(0, start - 48): min(len(text), end + 48)].lower()
    promo_near = (
        'save', 'off', 'flat', 'upto', 'up to', 'worth', 'get ₹', 'get rs',
        'cashback offer', 'discount', 'coupon', 'promo', 'deal', 'sale',
        'reward points', 'free gift', 'win ', 'scratch', 'voucher',
        'minimum order', 'orders above', 'shop for',
    )
    return any(p in window for p in promo_near)


def _is_trusted_financial_sender(sender: str) -> bool:
    s = sender.lower()
    trusted = (
        'phonepe', 'paytm', 'googlepay', 'gpay', 'amazon pay', 'bhim', 'cred',
        'axis', 'hdfc', 'icici', 'sbi', 'kotak', 'yesbank', 'yes bank',
        'indusind', 'idfc', 'bankofbaroda', 'pnb', 'canara', 'unionbank',
        'razorpay', 'cashfree', 'swiggy', 'zomato', 'amazon', 'flipkart',
        'myntra', 'nykaa', 'blinkit', 'zepto', 'bigbasket', 'uber', 'ola',
        'makemytrip', 'bookmyshow', 'shiprocket', 'eatclub',
        'groww', 'zerodha', 'kite', 'upstox', 'angelone', 'angelbroking',
        'kuvera', 'smallcase', 'indmoney', 'etmoney', 'paytmmoney', 'hdfcsec',
        'icicidirect', '5paisa', 'motilal', 'nsdl', 'cdsl', 'camsonline',
        'kfintech', 'mfcentral', 'fyers', 'aliceblue', 'sharekhan', 'iifl',
        'sbimf', 'axismf', 'hdfcfund', 'icicipru', 'nippon', 'mirae',
        'alerts@', 'noreply@', 'no-reply@', 'statement@', 'transactions@',
    )
    return any(t in s for t in trusted)


# Promo / marketing noise — reject unless a strong debit signal overrides.
_PROMO_SUBJECT_RE = re.compile(
    r'(unsubscribe|newsletter|%[\s-]?off|flat\s*₹|flat\s*rs|save\s*upto|save\s*up\s*to|'
    r'limited[\s-]?time|exclusive\s+offer|deal\s+of|sale\s+ends|promo\s*code|'
    r'coupon\s*code|flash\s+sale|mega\s+sale|clearance|don.?t\s+miss|'
    r'congratulations.?you.?ve\s+won|claim\s+your\s+(?:reward|gift|prize)|'
    r'invite\s+friends|refer\s+(?:and|&)\s+earn|weekly\s+digest|'
    r'marketing\s+update|new\s+arrivals|just\s+for\s+you|'
    # Educational / content digests that quote example ₹ amounts (CRED etc.)
    r'credit\s+utilization|utilisation\s+ratio|the\s+fine\s+print|'
    r'\bdecoded\b|\bexplained\b|did\s+you\s+know|here.?s\s+why|'
    r'how\s+to\s+(?:improve|boost|fix|build)|tips?\s+to\s+|'
    r'money\s+tips?|credit\s+score\s+(?:tips?|guide|101)|'
    r'read\s+this|what\s+(?:is|are)\s+(?:a\s+)?credit|'
    r'weekly\s+wrap|month(?:ly)?\s+wrap|in\s+case\s+you\s+missed)',
    re.IGNORECASE,
)

_STRONG_TXN_RE = re.compile(
    r'(debited|spent|withdrawn|charged|txn\s+of|transaction\s+(?:of|successful|alert)|'
    r'payment\s+successful|paid\s+successfully|order\s+confirmed|order\s+placed|'
    r'upi\s*ref|neft|imps|rtgs|a/c\s*xx|account\s+xx|amount\s+paid|grand\s+total|'
    r'invoice\s+(?:total|for)|credit\s+card\s+statement|outstanding\s+(?:amount|due)|'
    r'minimum\s+amount\s+due|total\s+amount\s+due|emi\s+due|bill\s+paid|payment\s+received|'
    r'units?\s+allot(?:ted|ed)|order\s+executed|sip\s+(?:successful|instalment|installment|processed|done)|'
    r'shares?\s+bought|equity\s+delivery|amount\s+invested|investment\s+of|'
    r'you\s+invested|successfully\s+invested|allotment|redemption)',
    re.IGNORECASE,
)

# Content / digest mail — never treat example ₹ figures as expenses
_CONTENT_DIGEST_RE = re.compile(
    r'(credit\s+utilization|utilisation\s+ratio|the\s+fine\s+print|'
    r'\bdecoded\b|\bexplained\b|did\s+you\s+know|here.?s\s+why|'
    r'how\s+to\s+(?:improve|boost|fix|build)|tips?\s+to\b|'
    r'money\s+tips?|credit\s+health|score\s+decoded|'
    r'in\s+case\s+you\s+missed|weekly\s+(?:wrap|digest|roundup)|'
    r'read\s+on|swipe\s+up|know\s+more|learn\s+more|'
    r'your\s+credit\s+(?:report|score|limit)\s+(?:decoded|explained|guide)|'
    r'portfolio\s+(?:value|update|summary)|current\s+value|total\s+(?:returns?|gains?)|'
    r'\bxirr\b|\bcagr\b|market\s+(?:update|wrap|today)|stocks?\s+to\s+watch|watchlist|'
    r'your\s+investments?\s+(?:are|have)|learn\s+to\s+invest|nfo\s+(?:alert|open)|'
    r'what.?s\s+new\s+on\s+groww|motilal\s+oswal\s+(?:research|view|digest)|weekly\s+market)',
    re.IGNORECASE,
)


def is_marketing_or_content_email(subject: str, snippet: str = '', body: str = '', sender: str = '') -> bool:
    """True for newsletters / educational digests that are not payments."""
    head = f"{subject or ''}\n{snippet or ''}"
    if _CONTENT_DIGEST_RE.search(head):
        return True
    if _PROMO_SUBJECT_RE.search(head):
        return True
    sender_l = (sender or '').lower()
    # CRED sends many editorial mails; only payment-shaped subjects count as spend
    if 'cred' in sender_l or 'cred.club' in sender_l:
        if not _STRONG_TXN_RE.search(head) and not _STRONG_TXN_RE.search((body or '')[:1200]):
            soft = sum(
                1 for k in (
                    'utilization', 'utilisation', 'fine print', 'decoded', 'explained',
                    'tips', 'guide', 'know more', 'read', 'credit score', 'credit limit',
                    'unsubscribe', 'newsletter', 'digest',
                ) if k in head.lower() or k in (body or '')[:800].lower()
            )
            if soft >= 1 and not re.search(
                r'\b(bill\s+paid|payment\s+(?:successful|received|done)|debited|emi\s+paid|'
                r'cleared\s+your|settled|txn\s+alert)\b',
                head + '\n' + (body or '')[:800],
                re.IGNORECASE,
            ):
                return True
    return False


def is_promotional_noise(subject: str, snippet: str = '', body: str = '', sender: str = '') -> bool:
    """
    Drop marketing / promo mail that happens to mention rupee amounts.
    Keep real debit / order / statement mail even if it also has offer copy.
    Never drop broker / AMC investment senders (Groww, Zerodha, etc.).
    """
    sender_l = (sender or '').lower()
    investment_senders = (
        'groww', 'zerodha', 'kite', 'upstox', 'angelone', 'angelbroking',
        'kuvera', 'smallcase', 'indmoney', 'etmoney', 'paytmmoney', 'hdfcsec',
        'icicidirect', '5paisa', 'motilal', 'nsdl', 'cdsl', 'camsonline',
        'kfintech', 'mfcentral', 'fyers', 'aliceblue', 'sharekhan', 'iifl',
        'sbimf', 'axismf', 'hdfcfund', 'icicipru', 'nippon', 'mirae', 'coin.zerodha',
        'growwmail', 'zrdha',
    )
    if any(k in sender_l for k in investment_senders):
        # Still drop broker digests / portfolio updates without a real invest cue
        head = f"{subject}\n{snippet}"
        if _CONTENT_DIGEST_RE.search(head) and not re.search(
            r'\b(units?\s+allot|order\s+executed|sip\s+(?:successful|instalment|installment|processed)|'
            r'you\s+invested|successfully\s+invested|amount\s+invested|shares?\s+bought|'
            r'equity\s+delivery|debited)\b',
            head,
            re.IGNORECASE,
        ):
            return True
        return False

    # Content digests / CRED editorials — always drop (even if a ₹ figure appears)
    if is_marketing_or_content_email(subject, snippet, body, sender):
        # Override only when the subject itself is clearly a payment alert
        head = f"{subject}\n{snippet}"
        if not re.search(
            r'\b(bill\s+paid|payment\s+(?:successful|received|done)|debited|'
            r'emi\s+(?:paid|due)|txn\s+alert|transaction\s+alert|'
            r'amount\s+due|statement\s+ready)\b',
            head,
            re.IGNORECASE,
        ):
            return True

    head = f"{subject}\n{snippet}"
    if _STRONG_TXN_RE.search(head) or _STRONG_TXN_RE.search(body[:2000] if body else ''):
        # Still drop if subject is clearly editorial and body only mentions ₹ in examples
        if _CONTENT_DIGEST_RE.search(subject or '') and not re.search(
            r'\b(debited|bill\s+paid|payment\s+successful|txn\s+alert)\b',
            head,
            re.IGNORECASE,
        ):
            return True
        return False
    if _is_trusted_financial_sender(sender) and any(
        k in head.lower() for k in (
            'debited', 'spent', 'statement', 'invoice', 'order confirmed', 'paid',
            'units allotted', 'order executed', 'sip', 'mutual fund', 'invested',
            'allotment', 'redeemed',
        )
    ):
        # "paid" alone is too weak for CRED content ("get paid to…") — require stronger cue
        if 'cred' in sender_l and not re.search(
            r'\b(bill\s+paid|payment\s+(?:successful|received)|debited|emi\s+paid|'
            r'txn|transaction\s+alert|amount\s+due)\b',
            head,
            re.IGNORECASE,
        ):
            pass  # fall through to promo checks
        else:
            return False
    blob = f"{subject}\n{snippet}\n{(body or '')[:1500]}"
    if _PROMO_SUBJECT_RE.search(blob):
        return True
    soft = sum(
        1 for k in (
            'offer', 'discount', 'cashback', 'coupon', 'sale', 'deal',
            'subscribe', 'newsletter', 'unsubscribe',
        ) if k in blob.lower()
    )
    return soft >= 3


def extract_amount_bill(text):
    match = re.search(r'(?:rs\.?|inr|₹|amount|total)\s*[:\s]*([\d,]+\.?\d*)', text, re.IGNORECASE)
    if match:
        clean_val = match.group(1).replace(',', '')
        try:
            val = float(clean_val)
            return f"₹ {val:,.2f}"
        except Exception:
            return "N/A"
    return "N/A"


def parse_bill_fields(subject, snippet):
    """Extract Cred-style bill metadata from email subject + snippet (no PDF)."""
    text = f"{subject or ''} {snippet or ''}"
    text_lower = text.lower()

    due_date = ''
    for pat in (
        r'(?:due\s+(?:on|by|date)[:\s]+)(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
        r'(?:payment\s+due\s+(?:on|by)[:\s]+)(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
        r'(?:due\s+date[:\s]+)(\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4})',
        r'(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})',
    ):
        m = re.search(pat, text_lower, re.IGNORECASE)
        if m:
            due_date = _parse_date_iso(m.group(1)) or m.group(1).strip()
            break

    minimum_due = 'N/A'
    m = re.search(
        r'(?:minimum\s+(?:amount\s+)?due|min\.?\s+due|mad)[:\s]*(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)',
        text_lower,
        re.IGNORECASE,
    )
    if m:
        try:
            minimum_due = f"₹ {float(m.group(1).replace(',', '')):,.2f}"
        except Exception:
            pass

    total_due = 'N/A'
    m = re.search(
        r'(?:total\s+(?:amount\s+)?due|total\s+due|outstanding(?:\s+amount)?|amount\s+due)[:\s]*(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)',
        text_lower,
        re.IGNORECASE,
    )
    if m:
        try:
            total_due = f"₹ {float(m.group(1).replace(',', '')):,.2f}"
        except Exception:
            pass

    return due_date, minimum_due, total_due


def classify_type_bill(subject, snippet):
    text = (subject + snippet).lower()
    if any(k in text for k in ['statement', 'due', 'outstanding', 'minimum amount']):
        return 'Credit Card Bill'
    if 'invoice' in text:
        return 'Invoice'
    if 'bill' in text:
        return 'Bill'
    return 'Bill Transaction'


def get_financial_score(subject, snippet, sender=''):
    """Scores email relevance for bill detection; promo cues subtract."""
    patterns = {
        'bill': 5, 'statement': 6, 'debited': 7, 'credited': 4,
        'outstanding': 6, 'invoice': 5, 'due': 3, 'transaction': 3,
        'payment': 3, 'inr': 2, 'emi': 4, 'a/c': 3, 'upi': 3,
    }
    text = (subject + ' ' + snippet).lower()
    score = sum(weight for kw, weight in patterns.items() if kw in text)
    if _is_trusted_financial_sender(sender):
        score += 4
    # Penalize marketing noise
    for bad in ('unsubscribe', 'newsletter', '% off', 'flat ₹', 'flash sale', 'coupon', 'deal of'):
        if bad in text:
            score -= 6
    return score


def extract_amount_from_snippet(text):
    """Prefer debit/due phrasing; skip promo-adjacent figures."""
    for pattern in (
        r'(?:debited|spent|outstanding|amount due|total due|minimum due|emi)'
        r'[^0-9₹RsINR]{0,24}(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)',
        r'(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)\s*(?:debited|spent|due|outstanding)',
        r'(?:total amount due|amount due|outstanding(?:\s+amount)?)[:\s]*(?:rs\.?|inr|₹)?\s*([\d,]+\.?\d*)',
    ):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            clean_val = match.group(1).replace(',', '')
            try:
                val = float(clean_val)
                if val >= 5:
                    return f"₹ {val:,.2f}"
            except Exception:
                pass

    match = re.search(r'(?:rs\.?|inr|₹|amount|total)\s*[:\s]*([\d,]+\.?\d*)', text, re.IGNORECASE)
    if match:
        if _looks_like_promo_amount(text, match.start(), match.end()):
            return "N/A"
        clean_val = match.group(1).replace(',', '')
        try:
            val = float(clean_val)
            if val >= 5:
                return f"₹ {val:,.2f}"
        except Exception:
            pass
    return "N/A"


def _newer_than_clause(since_days=None, default='2y'):
    """Gmail search window — incremental rescans use since_days from last scan."""
    if since_days is not None:
        try:
            days = int(since_days)
            if days > 0:
                return f'newer_than:{days}d'
        except (TypeError, ValueError):
            pass
    return f'newer_than:{default}'


def _gmail_expense_query(since_days=None) -> str:
    """
    Fetch real purchase / UPI / bank debit / investment mail.
    Explicitly exclude Gmail Promotions / Social / Forums.
    """
    banks = (
        'from:(phonepe.com OR paytm.com OR google.com OR amazonpay.in OR bhimupi.org.in OR '
        'cred.club OR axisbank.com OR axis.bank.in OR hdfcbank.net OR hdfcbank.com OR '
        'icicibank.com OR onlinesbi.com OR sbi.co.in OR kotak.com OR yesbank.in OR '
        'indusind.com OR idfcfirstbank.com OR bankofbaroda.in OR pnbindia.in OR '
        'canarabank.com OR unionbankofindia.co.in OR razorpay.com)'
    )
    merchants = (
        'from:(swiggy.in OR zomato.com OR amazon.in OR flipkart.com OR myntra.com OR '
        'nykaa.com OR blinkit.com OR zepto.co OR bigbasket.com OR uber.com OR olacabs.com OR '
        'makemytrip.com OR bookmyshow.com OR shiprocket.in OR eatclub.in)'
    )
    investments = (
        'from:(groww.in OR groww.com OR growwmail.com OR zerodha.com OR kite.trade OR '
        'upstox.com OR angelone.in OR angelbroking.com OR kuvera.in OR smallcase.com OR '
        'indmoney.com OR etmoney.com OR paytmmoney.com OR hdfcsec.com OR icicidirect.com OR '
        '5paisa.com OR motilaloswal.com OR coin.zerodha.com OR nsdl.com OR cdslindia.com OR '
        'camsonline.com OR kfintech.com OR mfcentral.com OR fyers.in OR aliceblueonline.com OR '
        'sharekhan.com OR iifl.com OR sbimf.com OR axismf.com OR hdfcfund.com OR '
        'icicipruamc.com OR nipponindiamf.com OR paragparikh.com OR miraeassetmf.co.in OR '
        'geojit.com)'
    )
    # Transactional subject cues catch bank alerts that land in Primary/Updates
    subjects = (
        'subject:(debited OR spent OR "transaction successful" OR "payment successful" OR '
        '"order confirmed" OR "order placed" OR "upi" OR "txn alert" OR "account alert" OR '
        'receipt OR invoice OR "amount paid" OR "units allotted" OR "units allocated" OR '
        '"order executed" OR "sip successful" OR "sip instalment" OR "sip installment" OR '
        '"mutual fund" OR "shares bought" OR "equity delivery" OR folio OR "nav " OR '
        '"systematic investment" OR "you invested" OR "successfully invested" OR '
        '"sip processed" OR allotment OR redemption)'
    )
    return (
        f'((category:purchases) OR ({banks}) OR ({merchants}) OR ({investments}) OR ({subjects})) '
        f'-category:promotions -category:social -category:forums '
        f'-subject:(newsletter OR unsubscribe OR "% off" OR "flat rs" OR "flash sale" OR '
        f'"refer and earn" OR "invite friends" OR "credit utilization" OR "fine print" OR '
        f'decoded OR "did you know" OR "money tips" OR "weekly digest" OR "weekly wrap") '
        f'{_newer_than_clause(since_days)}'
    )


def _gmail_investment_query(since_days=None) -> str:
    """
    Wider net for broker / AMC mail. Does NOT exclude Promotions —
    Groww/Zerodha confirmations often land outside Primary.
    """
    return (
        '('
        'from:(groww.in OR groww.com OR growwmail.com OR zerodha.com OR kite.trade OR '
        'upstox.com OR angelone.in OR angelbroking.com OR kuvera.in OR smallcase.com OR '
        'indmoney.com OR etmoney.com OR paytmmoney.com OR hdfcsec.com OR icicidirect.com OR '
        '5paisa.com OR motilaloswal.com OR coin.zerodha.com OR nsdl.com OR cdslindia.com OR '
        'camsonline.com OR kfintech.com OR mfcentral.com OR fyers.in OR aliceblueonline.com OR '
        'sharekhan.com OR iifl.com OR sbimf.com OR axismf.com OR hdfcfund.com OR '
        'icicipruamc.com OR nipponindiamf.com OR paragparikh.com OR miraeassetmf.co.in) '
        'OR subject:("units allotted" OR "units allocated" OR "order executed" OR '
        '"sip successful" OR "sip instalment" OR "sip installment" OR "sip processed" OR '
        '"you invested" OR "successfully invested" OR "amount invested" OR "mutual fund" OR '
        '"shares bought" OR "equity delivery" OR "systematic investment" OR allotment)'
        ') '
        '-category:social -category:forums '
        '-subject:(newsletter OR "% off" OR "flash sale" OR "refer and earn" OR "invite friends" OR '
        '"learn to invest" OR "markets today" OR "weekly digest") '
        f'{_newer_than_clause(since_days)}'
    )


def _gmail_bill_query(since_days=None) -> str:
    return (
        '('
        'subject:(statement OR outstanding OR "amount due" OR "minimum due" OR "total amount due" OR '
        'invoice OR debited OR "credit card bill" OR emi OR "bill payment" OR "payment due") '
        'OR from:(hdfcbank.net OR hdfcbank.com OR icicibank.com OR axisbank.com OR axis.bank.in OR '
        'onlinesbi.com OR kotak.com OR yesbank.in OR indusind.com OR rblbank.com OR '
        'idfcfirstbank.com OR amex.com OR americanexpress.com OR dinersclub.com OR sbicard.com OR '
        'cred.club OR alerts.hdfcbank.net OR notification.axisbank.com)'
        ') '
        '-category:promotions -category:social -category:forums '
        '-subject:(newsletter OR "% off" OR "flash sale" OR coupon OR "deal of") '
        f'{_newer_than_clause(since_days, default="1y")}'
    )


def execute_expense_scanner(gmail_service, since_days=None):
    """
    Full-body purchase/expense scanner.
    Targets purchases + bank/UPI/merchant senders; excludes Gmail Promotions.
    Output type: 'Transaction' → shown in Expenses tab.
    """
    emails_data = []
    query = _gmail_expense_query(since_days)

    try:
        sys.stderr.write("Expense Scanner: Fetching purchase emails...\n")
        sys.stderr.write(f"Expense Scanner query: {query}\n")
        response = gmail_service.users().messages().list(userId='me', q=query, maxResults=200).execute()
        messages = response.get('messages', [])
        # Paginate once more for important older alerts
        page_token = response.get('nextPageToken')
        if page_token and len(messages) < 350:
            more = gmail_service.users().messages().list(
                userId='me', q=query, maxResults=150, pageToken=page_token,
            ).execute()
            messages.extend(more.get('messages', []))
        sys.stderr.write(f"Expense Scanner: Found {len(messages)} emails. Batch fetching full bodies...\n")

        if not messages:
            return []

        messages_details = {}
        def expense_batch_callback(request_id, response, exception):
            if exception is None:
                messages_details[request_id] = response
            else:
                sys.stderr.write(f"Expense batch error for {request_id}: {str(exception)}\n")

        chunk_size = 50
        for i in range(0, len(messages), chunk_size):
            chunk = messages[i:i + chunk_size]
            batch = gmail_service.new_batch_http_request(callback=expense_batch_callback)
            for msg in chunk:
                batch.add(
                    gmail_service.users().messages().get(userId='me', id=msg['id'], format='full'),
                    request_id=msg['id']
                )
            batch.execute()

        sys.stderr.write(f"Expense Scanner: Processing {len(messages_details)} emails...\n")
        skipped_promo = 0

        for msg in messages:
            msg_id = msg['id']
            if msg_id not in messages_details:
                continue
            m = messages_details[msg_id]
            try:
                payload = m.get('payload', {})
                headers = payload.get('headers', [])
                headers_dict = {h['name'].lower(): h['value'] for h in headers}
                snippet = m.get('snippet', '')

                subject = headers_dict.get('subject', '(No Subject)')
                sender = headers_dict.get('from', '(Unknown Sender)')
                date = headers_dict.get('date', '(Unknown Date)')

                html_content, pdf_content = extract_all_body_and_attachments(gmail_service, msg_id, payload)
                soup = BeautifulSoup(html_content, 'html.parser')
                clean_html_text = soup.get_text(separator=' ').strip()
                unified_corpus = f"{clean_html_text}\n{snippet}\n{pdf_content}"

                if is_promotional_noise(subject, snippet, unified_corpus, sender):
                    skipped_promo += 1
                    continue

                brand, amount, description = parse_transaction_data_expense(unified_corpus, sender, subject)

                # Final gate: example ₹ in content digests must never become expenses
                if amount != "N/A" and is_marketing_or_content_email(
                    subject, snippet, unified_corpus, sender,
                ):
                    skipped_promo += 1
                    continue

                if amount != "N/A":
                    flags = classify_order_signals(subject, sender, description, unified_corpus)
                    date_raw = str(date or '').strip()
                    date_iso = _parse_date_iso(date_raw)
                    emails_data.append({
                        'brandName': brand,
                        'amount': amount,
                        'description': description,
                        'date': date_iso or date_raw,
                        'sender': sender,
                        'type': 'Transaction',
                        'messageId': msg_id,
                        **flags,
                    })
            except Exception as e:
                sys.stderr.write(f"Expense Scanner: Failed parsing {msg_id}: {str(e)}\n")

        sys.stderr.write(f"Expense Scanner: Skipped {skipped_promo} promotional emails.\n")

    except Exception as e:
        sys.stderr.write(f"Expense Scanner: Query failed: {str(e)}\n")

    sys.stderr.write(f"Expense Scanner: Extracted {len(emails_data)} expense transactions.\n")
    return emails_data


def execute_investment_scanner(gmail_service, since_days=None):
    """
    Dedicated Groww / Zerodha / broker / AMC pass.
    Includes Promotions-tab mail that the expense query excludes.
    """
    emails_data = []
    query = _gmail_investment_query(since_days)
    try:
        sys.stderr.write("Investment Scanner: Fetching broker/AMC emails...\n")
        sys.stderr.write(f"Investment Scanner query: {query}\n")
        response = gmail_service.users().messages().list(userId='me', q=query, maxResults=150).execute()
        messages = response.get('messages', [])
        page_token = response.get('nextPageToken')
        if page_token and len(messages) < 250:
            more = gmail_service.users().messages().list(
                userId='me', q=query, maxResults=100, pageToken=page_token,
            ).execute()
            messages.extend(more.get('messages', []))
        sys.stderr.write(f"Investment Scanner: Found {len(messages)} emails.\n")
        if not messages:
            return []

        messages_details = {}
        def batch_callback(request_id, response, exception):
            if exception is None:
                messages_details[request_id] = response
            else:
                sys.stderr.write(f"Investment batch error for {request_id}: {str(exception)}\n")

        chunk_size = 50
        for i in range(0, len(messages), chunk_size):
            chunk = messages[i:i + chunk_size]
            batch = gmail_service.new_batch_http_request(callback=batch_callback)
            for msg in chunk:
                msg_id = msg['id']
                batch.add(
                    gmail_service.users().messages().get(userId='me', id=msg_id, format='full'),
                    request_id=msg_id,
                )
            batch.execute()

        for msg_id, m in messages_details.items():
            try:
                payload = m.get('payload', {})
                headers = payload.get('headers', [])
                headers_dict = {h['name'].lower(): h['value'] for h in headers}
                snippet = m.get('snippet', '')
                subject = headers_dict.get('subject', '(No Subject)')
                sender = headers_dict.get('from', '(Unknown Sender)')
                date = headers_dict.get('date', '(Unknown Date)')

                html_content, pdf_content = extract_all_body_and_attachments(gmail_service, msg_id, payload)
                soup = BeautifulSoup(html_content, 'html.parser')
                clean_html_text = soup.get_text(separator=' ').strip()
                unified_corpus = f"{clean_html_text}\n{snippet}\n{pdf_content}"

                # Soft filter only — investment senders already bypass promo noise
                if is_promotional_noise(subject, snippet, unified_corpus, sender):
                    continue

                brand, amount, description = parse_transaction_data_expense(unified_corpus, sender, subject)
                if amount == "N/A":
                    continue
                if 'investment' not in (description or '').lower():
                    description = f"investment · {description}"
                flags = classify_order_signals(subject, sender, description, unified_corpus)
                emails_data.append({
                    'brandName': brand,
                    'amount': amount,
                    'description': description,
                    'date': _parse_date_iso(str(date or '').strip()) or str(date or '').strip(),
                    'sender': sender,
                    'type': 'Transaction',
                    'messageId': msg_id,
                    **flags,
                })
            except Exception as e:
                sys.stderr.write(f"Investment Scanner: Failed parsing {msg_id}: {str(e)}\n")
    except Exception as e:
        sys.stderr.write(f"Investment Scanner: Query failed: {str(e)}\n")

    sys.stderr.write(f"Investment Scanner: Extracted {len(emails_data)} investment transactions.\n")
    return emails_data


def execute_bill_scanner(gmail_service, since_days=None):
    """
    Fast metadata bill scanner using financial scoring.
    Excludes promotions and bare attachment-only mail.
    """
    emails_data = []
    query = _gmail_bill_query(since_days)

    try:
        sys.stderr.write("Bill Scanner: Fetching bill candidate emails...\n")
        sys.stderr.write(f"Bill Scanner query: {query}\n")
        response = gmail_service.users().messages().list(userId='me', q=query, maxResults=300).execute()
        messages = response.get('messages', [])
        sys.stderr.write(f"Bill Scanner: Found {len(messages)} candidates. Scoring...\n")

        if not messages:
            return []

        seen_keys = set()
        skipped_promo = 0

        for msg in messages:
            try:
                m = gmail_service.users().messages().get(
                    userId='me', id=msg['id'], format='metadata',
                    metadataHeaders=['From', 'Subject', 'Date']
                ).execute()

                headers = {h['name']: h['value'] for h in m['payload']['headers']}
                snippet = m.get('snippet', '')
                subject = headers.get('Subject', '(No Subject)')
                sender = headers.get('From', '(Unknown Sender)')
                date = headers.get('Date', '(Unknown Date)')

                if is_promotional_noise(subject, snippet, '', sender):
                    skipped_promo += 1
                    continue

                score = get_financial_score(subject, snippet, sender)
                # Stricter bar for non-bank senders
                min_score = 5 if _is_trusted_financial_sender(sender) else 8
                if score < min_score:
                    continue

                amount = extract_amount_from_snippet(snippet + " " + subject)
                if amount == "N/A":
                    continue

                bill_type = classify_type_bill(subject, snippet)
                due_date, minimum_due, total_due = parse_bill_fields(subject, snippet)

                brand = re.sub(r'\s*<.*?>', '', sender).replace('"', '').replace("'", "").strip()
                description = subject[:80].strip()
                mail_date = _parse_date_iso(str(date or '').strip()) or str(date or '').strip()

                dedup_key = f"{msg['id']}|{brand}|{mail_date}|{amount}"
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)

                emails_data.append({
                    'brandName': brand,
                    'amount': total_due if total_due != 'N/A' else amount,
                    'description': description,
                    'date': mail_date,
                    'sender': sender,
                    'type': bill_type,
                    'messageId': msg['id'],
                    'dueDate': due_date or None,
                    'minimumDue': minimum_due if minimum_due != 'N/A' else None,
                    'totalDue': total_due if total_due != 'N/A' else amount,
                })

            except Exception as e:
                sys.stderr.write(f"Bill Scanner: Failed parsing {msg['id']}: {str(e)}\n")

        sys.stderr.write(f"Bill Scanner: Skipped {skipped_promo} promotional emails.\n")

    except Exception as e:
        sys.stderr.write(f"Bill Scanner: Query failed: {str(e)}\n")

    sys.stderr.write(f"Bill Scanner: Extracted {len(emails_data)} bill records.\n")
    return emails_data


def _financial_merge_key(item):
    mid = item.get('messageId')
    if mid:
        return f"msg:{mid}"
    date = _parse_date_iso(item.get('date')) or str(item.get('date') or '')[:10]
    return f"{item.get('brandName')}|{date}|{item.get('amount')}|{item.get('type', '')}"


def execute_financial_scanner(gmail_service, since_days=None):
    """
    Orchestrator: expenses + investments + bills, then merge/dedupe.
    - Expenses / investments → type='Transaction' → Expenses + Planning Investment
    - Bills → Credit Card Bill / Invoice / Bill → Bills tab
    """
    sys.stderr.write("=== Starting Dual-Mode Financial Scanner ===\n")

    expense_data = execute_expense_scanner(gmail_service, since_days)
    investment_data = execute_investment_scanner(gmail_service, since_days)
    bill_data = execute_bill_scanner(gmail_service, since_days)

    seen = set()
    combined = []
    for item in expense_data + investment_data + bill_data:
        key = _financial_merge_key(item)
        if key not in seen:
            seen.add(key)
            combined.append(item)

    sys.stderr.write(
        f"=== Total unique financial records: {len(combined)} "
        f"(expenses: {len(expense_data)}, investments: {len(investment_data)}, bills: {len(bill_data)}) ===\n"
    )
    return combined

def _parse_amount_value(amount_str):
    """'₹ 1,234.50' -> (1234.5, 'INR'); '$ 12.00' -> (12.0, 'USD')."""
    if not amount_str or amount_str == "N/A":
        return None, None
    currency = 'USD' if '$' in amount_str else 'INR'
    digits = re.sub(r'[^\d.]', '', amount_str)
    try:
        return float(digits), currency
    except Exception:
        return None, None


def _parse_date_iso(date_str):
    if not date_str:
        return ""
    raw = str(date_str).strip()
    if raw.lower() in ('(unknown date)', 'unknown date', 'n/a'):
        return ""
    try:
        return parsedate_to_datetime(raw).date().isoformat()
    except Exception:
        pass
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        pass
    for fmt in (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%b %d, %Y",
        "%d %b %Y",
        "%a, %d %b %Y",
        "%Y/%m/%d",
    ):
        try:
            return datetime.strptime(raw[:48], fmt).date().isoformat()
        except Exception:
            continue
    # Legacy cache rows stored mangled dates like "Mon, 17 Aug" (year stripped).
    today = datetime.utcnow().date()
    for fmt in ("%a, %d %b", "%d %b", "%b %d"):
        try:
            parsed = datetime.strptime(raw[:32].strip(), fmt).date()
            if parsed.year == 1900:
                parsed = parsed.replace(year=today.year)
            return parsed.isoformat()
        except Exception:
            continue
    return ""


def classify_order_signals(subject, sender, description, corpus=''):
    """Detect COD / prepaid / return / refund / reject / fail from Gmail text."""
    text = f"{subject or ''}\n{sender or ''}\n{description or ''}\n{corpus or ''}".lower()

    # IMPORTANT: do NOT match bare "return" / "returns" — that fires on
    # "expected returns", "return on investment", email footers, etc. and
    # collapses Yureka Score on every rescan that pulls broker mail.
    returned = bool(re.search(
        r'\b(rto|returned|returning|reverse pickup|return initiated|return picked|'
        r'return request|return approved|return rejected|item (?:was )?returned|'
        r'exchange initiated|pickup for return)\b',
        text,
    )) and not re.search(
        r'\b(expected returns?|annual(?:ized)? returns?|return on invest|'
        r'tax returns?|total returns?|absolute returns?|cagr|xirr)\b',
        text,
    )
    refunded = bool(re.search(
        r'\b(refunded|refunding|refund processed|reversal processed|'
        r'amount (?:has been )?refunded|refund (?:initiated|completed|credited))\b',
        text,
    ))
    rejected = bool(re.search(
        r'\b(payment (?:declined|rejected|failed)|transaction (?:declined|rejected)|'
        r'insufficient (?:funds|balance)|card declined|bank declined)\b',
        text,
    ))
    failed = bool(re.search(
        r'\b(order (?:failed|canceled|cancelled)|could not (?:be )?process|'
        r'payment unsuccessful|transaction failed|unable to place)\b',
        text,
    ))
    # Avoid bare \bcod\b alone in long bodies — require payment/order context
    is_cod = bool(re.search(
        r'cash[\s-]?on[\s-]?delivery|pay[\s-]?on[\s-]?delivery|pay[\s-]?at[\s-]?delivery|'
        r'(?:payment\s*(?:mode|method|type)|paid\s*(?:by|via)|pay\s*method)\s*[:\-]?\s*cod\b|'
        r'\bcod\s+(?:order|payment|amount|collect|charge)|'
        r'\bcollect\s+cod\b',
        text,
    ))
    prepaid_hint = bool(re.search(
        r'\b(prepaid|paid online|amount paid|payment successful|upi|netbanking|'
        r'you paid|paid via (?:card|upi|net)|online paid|debited)\b',
        text,
    ))
    if is_cod:
        payment_mode = 'cod'
        prepaid = False
    else:
        payment_mode = 'prepaid'
        prepaid = prepaid_hint or not (returned or refunded or rejected or failed)

    return {
        'paymentMode': payment_mode,
        'cod': bool(is_cod),
        'prepaid': bool(prepaid),
        'returned': returned,
        'refunded': refunded,
        'rejected': rejected,
        'failed': failed,
    }


def _in_last_months(date_iso, months=6):
    if not date_iso or len(str(date_iso)) < 7:
        return False
    try:
        d = datetime.fromisoformat(str(date_iso)[:10]).date()
        return (datetime.utcnow().date() - d).days <= int(months * 30.5) + 2
    except Exception:
        return False


def _tx_dedupe_key(t):
    brand = str(t.get('brandName') or '').strip().lower()
    amount = str(t.get('amount') or '').strip().lower()
    date = str(t.get('date') or '')[:10]
    sender = str(t.get('sender') or '').strip().lower()
    desc = str(t.get('description') or '').strip().lower()[:80]
    return '|'.join([brand, amount, date, sender, desc])


def _dedupe_transactions(transactions):
    """Drop exact duplicate ledger rows before scoring (multi-inbox / rescan)."""
    seen = set()
    out = []
    for t in transactions or []:
        key = _tx_dedupe_key(t)
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out


_INVESTMENT_SCORE_EXCLUDE = (
    'groww', 'zerodha', 'kite.trade', 'upstox', 'angelone', 'angelbroking', 'angel one',
    'kuvera', 'smallcase', 'indmoney', 'etmoney', 'paytmmoney', 'paytm money',
    'hdfcsec', 'icicidirect', '5paisa', 'coin.zerodha', 'investment ·',
    'mutual fund', 'units allotted', 'units allocated', 'sip successful',
    'sip instalment', 'sip installment', 'systematic investment', 'shares bought',
    'equity delivery', 'demat', 'nsdl', 'cdsl', 'camsonline', 'kfintech', 'mfcentral',
)


def _is_investment_for_score(t) -> bool:
    """SIPs / brokerage mail belongs in Planning, not underwriting spend."""
    hay = ' '.join([
        str(t.get('brandName') or ''),
        str(t.get('sender') or ''),
        str(t.get('description') or ''),
        str(t.get('type') or ''),
    ]).lower()
    return any(k in hay for k in _INVESTMENT_SCORE_EXCLUDE)


def _spend_tier_score(avg):
    """Avg monthly INR spend → 0–100. Bands are inclusive lower bound."""
    if avg >= 100000: return 100
    if avg >= 95000:  return 90
    if avg >= 90000:  return 85
    if avg >= 85000:  return 80
    if avg >= 80000:  return 75
    if avg >= 75000:  return 70
    if avg >= 70000:  return 65
    if avg >= 65000:  return 60
    if avg >= 60000:  return 55
    if avg >= 55000:  return 50
    if avg >= 50000:  return 45
    if avg >= 45000:  return 40
    if avg >= 40000:  return 35
    if avg >= 35000:  return 30
    if avg >= 30000:  return 25
    if avg >= 25000:  return 20
    return max(0, round(20 * avg / 25000))


def compute_yureka_score(transactions):
    """
    Last-6-month INR purchase score.

    Base = avg monthly spend band.
    Plus: order volume, prepaid mix, merchant diversity.
    Minus: COD, returns, refunds, rejected payments, failed orders.
    Investments (Groww/Zerodha/SIP) are excluded — tracked in Planning only.
    """
    from collections import Counter

    transactions = _dedupe_transactions(transactions)

    window = []
    bills = []
    skipped_investments = 0
    undated_included = 0
    skipped_no_amount = 0
    skipped_fx = 0
    for t in transactions:
        if _is_investment_for_score(t):
            skipped_investments += 1
            continue
        value, currency = _parse_amount_value(t.get('amount'))
        if value is None:
            skipped_no_amount += 1
            continue
        if currency and currency != 'INR':
            skipped_fx += 1
            continue
        date_iso = _parse_date_iso(t.get('date'))
        if t.get('cod') or t.get('prepaid') or t.get('paymentMode'):
            flags = {
                'cod': bool(t.get('cod')),
                'prepaid': bool(t.get('prepaid')),
                'returned': bool(t.get('returned')),
                'refunded': bool(t.get('refunded')),
                'rejected': bool(t.get('rejected')),
                'failed': bool(t.get('failed')),
                'paymentMode': t.get('paymentMode') or ('cod' if t.get('cod') else 'prepaid'),
            }
            # Re-check return/refund with tightened rules using stored text
            # (legacy rows may carry false positives from bare "return").
            reclass = classify_order_signals(
                '', t.get('sender', ''), t.get('description', ''), '',
            )
            if flags['returned'] and not reclass['returned']:
                flags['returned'] = False
            if flags['refunded'] and not reclass['refunded']:
                flags['refunded'] = False
            if flags['cod'] and not reclass['cod']:
                flags['cod'] = False
                flags['paymentMode'] = 'prepaid'
                flags['prepaid'] = True
        else:
            flags = classify_order_signals(
                '', t.get('sender', ''), t.get('description', ''), '',
            )
        row = {
            'Brand': t.get('brandName', ''),
            'Value': value,
            'Currency': currency or 'INR',
            'DateISO': date_iso,
            **flags,
        }
        tx_type = str(t.get('type') or '').strip().lower()
        # Purchase / UPI / merchant mail (type Transaction). Bills stay out of spend.
        is_purchase = tx_type in ('', 'transaction', 'purchase', 'order', 'expense')
        if is_purchase:
            in_window = _in_last_months(date_iso, 6) if date_iso else False
            # Undated rows were previously dropped entirely — that under-counted spend
            # when Gmail headers failed to parse. Include them so Yu Points reflects
            # the same transactions members see in Expenses.
            if in_window or not date_iso:
                if not date_iso:
                    undated_included += 1
                window.append(row)
        else:
            bills.append(row)

    orders = len(window)
    prepaid = sum(1 for r in window if r.get('prepaid') or r.get('paymentMode') == 'prepaid')
    cod = sum(1 for r in window if r.get('cod') or r.get('paymentMode') == 'cod')
    returned = sum(1 for r in window if r.get('returned'))
    refunded = sum(1 for r in window if r.get('refunded'))
    rejected = sum(1 for r in window if r.get('rejected'))
    failed = sum(1 for r in window if r.get('failed'))

    counted = [
        r for r in window
        if not (r.get('returned') or r.get('refunded') or r.get('rejected') or r.get('failed'))
    ]
    spend_total = sum(r['Value'] for r in counted)
    avg_monthly_spend = spend_total / 6.0
    merchants = len({r['Brand'] for r in counted if r.get('Brand')})
    methods = Counter(
        'COD' if r.get('cod') else ('UPI' if r.get('prepaid') else 'Other')
        for r in window
    )

    base = _spend_tier_score(avg_monthly_spend)
    denom = max(1, orders)
    diversity = min(6, merchants // 2) if merchants else 0
    bonus = min(8, orders // 8) + round(6 * prepaid / denom) + diversity
    penalty = (
        round(12 * cod / denom)
        + min(16, returned * 2)
        + min(16, refunded * 2)
        + min(12, rejected * 3)
        + min(12, failed * 3)
    )
    total = max(0, min(100, int(round(base + bonus - penalty))))
    if total >= 70:
        decision = "Approved"
    elif total >= 40:
        decision = "Review"
    elif total >= 20:
        decision = "Conditional"
    else:
        decision = "Rejected"

    return {
        "score": total,
        "decision": decision,
        "metrics": {
            "window_months": 6,
            "orders_6m": orders,
            "prepaid_orders": prepaid,
            "cod_orders": cod,
            "returned_orders": returned,
            "refunded_orders": refunded,
            "rejected_payments": rejected,
            "failed_orders": failed,
            "spend_total_inr": round(spend_total, 2),
            "avg_monthly_spend_inr": round(avg_monthly_spend, 2),
            "spend_tier": base,
            "bonus": bonus,
            "penalty": penalty,
            "distinct_merchants": merchants,
            "has_credit_card": bool(bills),
            "payment_methods": dict(methods),
            "deduped_input": True,
            "excluded_investments": skipped_investments,
            "undated_included": undated_included,
            "skipped_no_amount": skipped_no_amount,
            "skipped_fx": skipped_fx,
        }
    }


def main():
    fallback_data = {}
    if len(sys.argv) > 2:
        try:
            fallback_data = json.loads(sys.argv[2])
        except Exception:
            pass

    gmail_service = None
    people_service = None
    
    try:
        gmail_service = get_local_gmail_service()
        creds = gmail_service._http.credentials
        people_service = build('people', 'v1', credentials=creds)
        sys.stderr.write("Successfully initialized services using local Desktop OAuth.\n")
    except Exception as local_err:
        sys.stderr.write(f"Local Desktop OAuth unavailable: {str(local_err)}\n")

        access_token = sys.argv[1] if len(sys.argv) > 1 else ""
        if access_token and access_token.strip():
            sys.stderr.write("Using browser access token from argv[1]...\n")
            creds = Credentials(token=access_token)
            try:
                people_service = build('people', 'v1', credentials=creds)
                gmail_service = build('gmail', 'v1', credentials=creds)
                sys.stderr.write("Successfully initialized services using browser access token.\n")
            except Exception as e:
                print(json.dumps({"error": f"Failed to initialize with access token: {str(e)}"}))
                return
        else:
            refresh_token = os.environ.get("GOOGLE_REFRESH_TOKEN", "")
            client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
            client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")

            if refresh_token and client_id and client_secret:
                sys.stderr.write("Using refresh token from environment variables for background sync...\n")
                try:
                    from google.oauth2.credentials import Credentials as OAuth2Credentials
                    creds = OAuth2Credentials(
                        token=None,
                        refresh_token=refresh_token,
                        client_id=client_id,
                        client_secret=client_secret,
                        token_uri="https://oauth2.googleapis.com/token",
                        scopes=SCOPES
                    )
                    from google.auth.transport.requests import Request as GRequest
                    creds.refresh(GRequest())
                    people_service = build('people', 'v1', credentials=creds)
                    gmail_service = build('gmail', 'v1', credentials=creds)
                    sys.stderr.write("Successfully initialized services using env refresh token.\n")
                except Exception as e:
                    print(json.dumps({"error": f"Env refresh token auth failed: {str(e)}"}))
                    return
            else:
                print(json.dumps({"error": "AUTH_EXPIRED", "details": "No valid credentials found. Set GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET on Render."}))
                return

    try:
        profile = fetch_user_profile(
            people_service,
            fallback_data.get('firstName', ''),
            fallback_data.get('lastName', ''),
            fallback_data.get('dateOfBirth', ''),
            fallback_data.get('gender', ''),
            fallback_data.get('mobileNumber', ''),
            fallback_data.get('location', '')
        )
        
        # Try getting email from gmail service if not found
        if not profile.get('email') and gmail_service:
            try:
                gmail_profile = gmail_service.users().getProfile(userId='me').execute()
                profile['email'] = gmail_profile.get('emailAddress')
            except Exception:
                pass
                
        # If still not found, fall back to fallback_data email
        if not profile.get('email'):
            profile['email'] = fallback_data.get('email', '')

    except Exception as e:
        err_msg = str(e)
        if "refresh" in err_msg.lower() or "invalid_grant" in err_msg.lower() or "credentials" in err_msg.lower() or "401" in err_msg:
            print(json.dumps({"error": "AUTH_EXPIRED", "details": err_msg}))
        else:
            print(json.dumps({"error": f"Failed to fetch profile: {err_msg}"}))
        return

    # Fast path: basic profile fields only (name/phone/dob/age/gender/location),
    # skips the slow Gmail inbox scan + score computation entirely.
    mode = sys.argv[3] if len(sys.argv) > 3 else ""
    if mode == "profile_only":
        print(json.dumps({"profile": profile}))
        return

    try:
        since_days = fallback_data.get('sinceDays')
        if since_days is not None:
            try:
                since_days = int(since_days)
            except (TypeError, ValueError):
                since_days = None
        if fallback_data.get('incremental') and since_days is None:
            since_days = 90
        transactions = execute_financial_scanner(gmail_service, since_days=since_days)
    except Exception as e:
        err_msg = str(e)
        if "refresh" in err_msg.lower() or "invalid_grant" in err_msg.lower() or "credentials" in err_msg.lower() or "401" in err_msg:
            print(json.dumps({"error": "AUTH_EXPIRED", "details": err_msg}))
        else:
            print(json.dumps({"error": f"Failed to scan emails: {err_msg}"}))
        return
    
    try:
        score = compute_yureka_score(transactions)
    except Exception as e:
        sys.stderr.write(f"Score computation failed: {str(e)}\n")
        score = None

    output = {
        "profile": profile,
        "transactions": transactions,
        "score": score
    }
    
    print(json.dumps(output))

if __name__ == "__main__":
    main()
