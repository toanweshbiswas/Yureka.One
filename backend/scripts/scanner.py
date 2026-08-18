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
    ])

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

    elif any(k in sender_lower for k in (
        "axis", "hdfc", "icici", "sbi", "kotak", "yes bank", "yesbank",
        "indusind", "idfc", "bob", "pnb", "canara", "union bank", "cred",
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
    r'marketing\s+update|new\s+arrivals|just\s+for\s+you)',
    re.IGNORECASE,
)

_STRONG_TXN_RE = re.compile(
    r'(debited|spent|withdrawn|charged|txn\s+of|transaction\s+(?:of|successful|alert)|'
    r'payment\s+successful|paid\s+successfully|order\s+confirmed|order\s+placed|'
    r'upi\s*ref|neft|imps|rtgs|a/c\s*xx|account\s+xx|amount\s+paid|grand\s+total|'
    r'invoice\s+(?:total|for)|credit\s+card\s+statement|outstanding\s+(?:amount|due)|'
    r'minimum\s+amount\s+due|total\s+amount\s+due|emi\s+due)',
    re.IGNORECASE,
)


def is_promotional_noise(subject: str, snippet: str = '', body: str = '', sender: str = '') -> bool:
    """
    Drop marketing / promo mail that happens to mention rupee amounts.
    Keep real debit / order / statement mail even if it also has offer copy.
    """
    head = f"{subject}\n{snippet}"
    if _STRONG_TXN_RE.search(head) or _STRONG_TXN_RE.search(body[:2000] if body else ''):
        return False
    if _is_trusted_financial_sender(sender) and any(
        k in head.lower() for k in ('debited', 'spent', 'statement', 'invoice', 'order confirmed', 'paid')
    ):
        return False
    blob = f"{subject}\n{snippet}\n{(body or '')[:1500]}"
    if _PROMO_SUBJECT_RE.search(blob):
        return True
    # Soft promo: many offer cues and no debit language
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


def _gmail_expense_query() -> str:
    """
    Fetch real purchase / UPI / bank debit mail.
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
    # Transactional subject cues catch bank alerts that land in Primary/Updates
    subjects = (
        'subject:(debited OR spent OR "transaction successful" OR "payment successful" OR '
        '"order confirmed" OR "order placed" OR "upi" OR "txn alert" OR "account alert" OR '
        'receipt OR invoice OR "amount paid")'
    )
    return (
        f'((category:purchases) OR ({banks}) OR ({merchants}) OR ({subjects})) '
        f'-category:promotions -category:social -category:forums '
        f'-subject:(newsletter OR unsubscribe OR "% off" OR "flat rs" OR "flash sale") '
        f'newer_than:2y'
    )


def _gmail_bill_query() -> str:
    return (
        '('
        'subject:(statement OR outstanding OR "amount due" OR "minimum due" OR invoice OR '
        'debited OR "credit card bill" OR emi OR "bill payment") '
        'OR from:(hdfcbank.net OR hdfcbank.com OR icicibank.com OR axisbank.com OR axis.bank.in OR '
        'onlinesbi.com OR kotak.com OR cred.club OR americanexpress.com OR dinersclub.com)'
        ') '
        '-category:promotions -category:social -category:forums '
        '-subject:(newsletter OR "% off" OR "flash sale" OR coupon OR "deal of") '
        'newer_than:2y'
    )


def execute_expense_scanner(gmail_service):
    """
    Full-body purchase/expense scanner.
    Targets purchases + bank/UPI/merchant senders; excludes Gmail Promotions.
    Output type: 'Transaction' → shown in Expenses tab.
    """
    emails_data = []
    query = _gmail_expense_query()

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

                if amount != "N/A":
                    flags = classify_order_signals(subject, sender, description, unified_corpus)
                    emails_data.append({
                        'brandName': brand,
                        'amount': amount,
                        'description': description,
                        'date': str(date or '').strip(),
                        'sender': sender,
                        'type': 'Transaction',
                        **flags,
                    })
            except Exception as e:
                sys.stderr.write(f"Expense Scanner: Failed parsing {msg_id}: {str(e)}\n")

        sys.stderr.write(f"Expense Scanner: Skipped {skipped_promo} promotional emails.\n")

    except Exception as e:
        sys.stderr.write(f"Expense Scanner: Query failed: {str(e)}\n")

    sys.stderr.write(f"Expense Scanner: Extracted {len(emails_data)} expense transactions.\n")
    return emails_data


def execute_bill_scanner(gmail_service):
    """
    Fast metadata bill scanner using financial scoring.
    Excludes promotions and bare attachment-only mail.
    """
    emails_data = []
    query = _gmail_bill_query()

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

                brand = re.sub(r'\s*<.*?>', '', sender).replace('"', '').replace("'", "").strip()
                description = subject[:80].strip()
                mail_date = str(date or '').strip()

                dedup_key = f"{brand}|{mail_date}|{amount}"
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)

                emails_data.append({
                    'brandName': brand,
                    'amount': amount,
                    'description': description,
                    'date': mail_date,
                    'sender': sender,
                    'type': bill_type
                })

            except Exception as e:
                sys.stderr.write(f"Bill Scanner: Failed parsing {msg['id']}: {str(e)}\n")

        sys.stderr.write(f"Bill Scanner: Skipped {skipped_promo} promotional emails.\n")

    except Exception as e:
        sys.stderr.write(f"Bill Scanner: Query failed: {str(e)}\n")

    sys.stderr.write(f"Bill Scanner: Extracted {len(emails_data)} bill records.\n")
    return emails_data


def execute_financial_scanner(gmail_service):
    """
    Orchestrator: Runs both Script 1 (expenses) and Script 2 (bills) scanners,
    then merges and deduplicates the results.
    - Expenses → type='Transaction' → shown in Expenses tab
    - Bills → type='Credit Card Bill'/'Invoice'/'Bill'/'Bill Transaction' → shown in Bills tab
    """
    sys.stderr.write("=== Starting Dual-Mode Financial Scanner ===\n")

    expense_data = execute_expense_scanner(gmail_service)
    bill_data = execute_bill_scanner(gmail_service)

    # Merge with deduplication by brand+date+amount
    seen = set()
    combined = []
    for item in expense_data + bill_data:
        key = f"{item['brandName']}|{item['date']}|{item['amount']}"
        if key not in seen:
            seen.add(key)
            combined.append(item)

    sys.stderr.write(f"=== Total unique financial records: {len(combined)} (expenses: {len(expense_data)}, bills: {len(bill_data)}) ===\n")
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

    returned = bool(re.search(
        r'\b(rto|return(?:ed|ing)?|reverse pickup|return initiated|return picked|'
        r'item (?:was )?returned|exchange initiated)\b',
        text,
    ))
    refunded = bool(re.search(
        r'\b(refund(?:ed|ing)?|refund processed|reversal processed|'
        r'amount (?:has been )?refunded|refund (?:initiated|completed))\b',
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
    is_cod = bool(re.search(
        r'cash[\s-]?on[\s-]?delivery|pay[\s-]?on[\s-]?delivery|pay[\s-]?at[\s-]?delivery|'
        r'(?:payment\s*(?:mode|method|type)|paid\s*(?:by|via)|pay\s*method)\s*[:\-]?\s*cod\b|'
        r'\bcod\s+(?:order|payment|amount|collect|charge)|'
        r'\bcollect\s+cod\b|\bcod\b',
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
    Plus: order volume, prepaid mix.
    Minus: COD, returns, refunds, rejected payments, failed orders.
    """
    from collections import Counter

    window = []
    bills = []
    for t in transactions:
        value, currency = _parse_amount_value(t.get('amount'))
        if value is None:
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
        else:
            flags = classify_order_signals(
                '', t.get('sender', ''), t.get('description', ''), '',
            )
        row = {
            'Brand': t.get('brandName', ''),
            'Value': value,
            'Currency': currency,
            'DateISO': date_iso,
            **flags,
        }
        tx_type = str(t.get('type') or '').strip().lower()
        if tx_type == 'transaction':
            if currency == 'INR' and _in_last_months(date_iso, 6):
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
    merchants = len({r['Brand'] for r in counted})
    methods = Counter(
        'COD' if r.get('cod') else ('UPI' if r.get('prepaid') else 'Other')
        for r in window
    )

    base = _spend_tier_score(avg_monthly_spend)
    denom = max(1, orders)
    bonus = min(8, orders // 8) + round(6 * prepaid / denom)
    penalty = (
        round(12 * cod / denom)
        + min(16, returned * 2)
        + min(16, refunded * 2)
        + min(12, rejected * 3)
        + min(12, failed * 3)
    )
    total = max(0, min(100, int(round(base + bonus - penalty))))
    decision = "Approved" if total >= 20 else "Rejected"

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
        transactions = execute_financial_scanner(gmail_service)
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
