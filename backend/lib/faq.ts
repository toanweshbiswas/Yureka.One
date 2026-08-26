// Single source of truth for the homepage FAQ. rendered by components/FAQ.tsx
// and reused server-side (server.ts) to emit FAQPage JSON-LD.
// Content aligned with AEO §4 of the Yureka SEO/AEO/GEO master document.

export interface FaqItem {
  q: string;
  a: string;
}

export const faqQuestions: FaqItem[] = [
  {
    q: 'What is Yureka.One?',
    a: "Yureka.One is India's first AI-native Wealth Operating System. It automatically converts rewards from your everyday spending into 24K digital gold (Yureka Goldback), uses an AI concierge to place and optimize your food, grocery, and shopping orders, and builds an alternative credit profile from your consented transaction data.",
  },
  {
    q: 'What is Yureka Goldback?',
    a: "Yureka Goldback is a reward asset, not a points program: instead of expiring loyalty coins, every eligible transaction earns you 24K digital gold that generates yield. up to 16% effective ROI. It is liquid, unified across all your spending, and requires no manual investing.",
  },
  {
    q: 'Is cashback in gold better than regular cashback?',
    a: "Regular cashback loses value sitting idle, and brand points expire or lock you in. Gold-based rewards appreciate: Goldback converts the same cashback into an asset with historical long-term growth plus reward yield, so your rewards compound instead of expiring.",
  },
  {
    q: 'Can AI really order food or groceries for me in India?',
    a: "Yes. Yureka AI is an official Swiggy Builders Club partner integrated with Swiggy's Model Context Protocol (Food, Instamart, Dineout). Tell it what you want; it compares prices across engines, applies the best-reward payment method, places the order, and converts the earnings into Yureka Goldback.",
  },
  {
    q: 'How can I build a credit profile from everyday spending?',
    a: "Yureka acts as an RBI-compliant Lending Service Provider: with your explicit consent, it analyzes your real transaction patterns. UPI, shopping, bill payments. to build an alternative credit profile that banks and NBFCs can use, bringing thin-file users into formal credit.",
  },
  {
    q: 'Is my data safe with Yureka?',
    a: "Yureka is compliance-by-design: consent-first data handling aligned with RBI's 2026 digital lending mandates and India's DPDP consent principles. Your data is never used without explicit permission, and consent is revocable at any time.",
  },
  {
    q: 'How much does Yureka cost?',
    a: "Premium is ₹99/month or ₹1,199/year. and 100% of the fee is reimbursed to you as 24K digital gold, so membership effectively pays for itself.",
  },
  {
    q: 'How do I join Yureka?',
    a: "Access is currently invite-gated: entry via member referrals or through high-engagement participation on Yureka's community content (LinkedIn/Reddit). Referrers earn commissions on referred users' activity for 12 months.",
  },
  {
    q: 'How is Yureka different from CRED, CashKaro, or Jar?',
    a: "CRED focuses on bill management; CashKaro offers cashback as cash; Jar lets you save in digital gold manually. Yureka combines rewards, AI ordering, and credit access into one loop: its AI concierge places your orders, earns Yureka Goldback (digital gold) automatically, and turns your transaction history into a credit profile. without you doing anything extra.",
  },
  {
    q: 'What is a Wealth Operating System?',
    a: "A Wealth Operating System (Wealth OS) is a platform that turns routine financial activity. spending, ordering, paying. into automated wealth-building. Yureka.One pioneered this category in India by converting transaction rewards into digital gold and transaction data into credit access.",
  },
];
