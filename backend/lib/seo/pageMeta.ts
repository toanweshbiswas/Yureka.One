// Framework-agnostic SEO registry — imported by both the browser bundle
// (components/SEO.tsx, page components) and the Node production server
// (server.ts) so the server-rendered <head> and the client-side overrides
// always agree on the same title/description/image per route.

export const SITE_URL = 'https://yureka.one';
export const SITE_NAME = 'Yureka One';
export const TWITTER_HANDLE = '@yurekaone';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-share.png`;
export const DEFAULT_DESCRIPTION =
  "Turn everyday spending into 24K digital gold. Yureka's AI concierge orders for you, pays Goldback up to 16% ROI, and builds your credit profile.";

export interface PageMeta {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  keywords?: string[];
  image?: string;
  robots?: string;
}

/** Appends the brand suffix unless the title already references it — kept as a
 *  shared function so the server-injected <title> and the client-side SEO.tsx
 *  mutation always produce byte-identical output (no hydration flicker). */
export function formatTitle(title: string): string {
  return title.includes('Yureka') || title.includes('|') ? title : `${title} | Yureka One`;
}

export const staticPageMeta: Record<string, PageMeta> = {
  '/': {
    title: "Yureka.One | India's AI Wealth OS — Spend, Earn Gold",
    description:
      "Turn everyday spending into 24K digital gold. Yureka's AI concierge orders for you, pays Goldback up to 16% ROI, and builds your credit profile.",
    ogTitle: "Yureka.One — Spend like always. Build wealth by default.",
    ogDescription:
      "India's first AI-native Wealth OS: an AI that shops for you, pays you in digital gold, and turns your transactions into a credit profile.",
    keywords: [
      'AI wealth app india', 'wealth operating system india', 'spend to earn gold',
      'AI money manager india', 'yureka one', 'goldback rewards', 'digital gold cashback',
      'earn gold on spending', 'agentic commerce app india', 'convert cashback to gold',
    ],
  },
  '/brands': {
    title: 'Brand Explorer | 80+ Partner Brands for Card Rewards | Yureka.One',
    description:
      "Browse Yureka's partner brand network across shopping, travel, food, and lifestyle. See exactly which credit cards maximize your cashback and Goldback at each brand.",
    keywords: [
      'credit card reward partners india', 'brand cashback offers india', 'pay with rewards india',
    ],
  },
  '/blog': {
    title: 'Goldback, AI shopping, and credit guides | Yureka.One',
    description:
      'Guides on earning Yureka Goldback from everyday spending, ordering food with AI, and building credit without a credit card.',
    keywords: [
      'digital gold cashback guide', 'AI shopping assistant india guide', 'build credit without credit card',
      'SGB alternative 2026', 'agentic commerce india', 'credit card strategy blog india',
      'is cashback in gold better than cash', 'alternative credit score india',
    ],
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Yureka.One',
    description:
      'How Yureka.One collects, uses, and protects your personal and financial data — covering transaction intelligence, DPDP consent, data retention, and your rights as a user.',
    keywords: ['yureka privacy policy', 'fintech data privacy india', 'DPDP consent digital gold app'],
    robots: 'index, follow',
  },
  '/terms-of-service': {
    title: 'Terms of Service | Yureka.One',
    description:
      'The terms governing your use of Yureka.One, including account eligibility, Yureka Goldback rewards, AI concierge usage, and LSP data-sharing rules.',
    keywords: ['yureka terms of service', 'yureka one terms and conditions'],
  },
  '/security-protocol': {
    title: 'Security Protocol | Yureka.One Infrastructure',
    description:
      "Detailed technical documentation of Yureka's security architecture — AES-256 encryption, Account Aggregator consent framework, and zero-knowledge transaction analysis.",
    keywords: ['yureka security', 'fintech data security india', 'account aggregator security'],
  },
  '/community-guidelines': {
    title: 'Community Guidelines | Yureka.One',
    description:
      "The standards that keep Yureka's community of power shoppers trustworthy — covering accurate data sharing, respectful conduct, and prohibited behavior.",
    keywords: ['yureka community guidelines', 'yureka code of conduct'],
  },
  '/about': {
    title: 'About Yureka.One — Founded by Anwesh Biswas',
    description:
      "Yureka.One is a Bengaluru fintech founded in 2026 by Anwesh Biswas. We build India's AI Wealth OS: Goldback, AI ordering, and alternative credit.",
    keywords: ['about yureka one', 'anwesh biswas yureka', 'yureka founder', 'wealth os india startup'],
  },
  '/contact': {
    title: 'Contact Yureka.One | support@yureka.one',
    description:
      'Email support@yureka.one for support, partnerships, press, and careers. Yureka.One is based in Bengaluru and serves shoppers across India.',
    keywords: ['yureka contact', 'yureka support email', 'support@yureka.one'],
  },
  '/faq': {
    title: 'Yureka.One FAQ — Goldback, AI ordering, credit',
    description:
      'What is Yureka Goldback? Can AI order food in India? How do you build credit without a card? Direct answers on pricing, data, and how to join.',
    keywords: ['yureka faq', 'what is goldback', 'yureka vs cred', 'wealth os meaning'],
  },
  '/manifesto': {
    title: 'The Yureka Manifesto | Spend. Accumulate. Evolve.',
    description:
      "Why Yureka.One exists: a Wealth OS for India's power shoppers who treat every transaction as a chance to earn digital gold and build credit.",
    keywords: ['yureka manifesto', 'wealth operating system india', 'power shopper philosophy'],
  },
  '/jobs': {
    title: "Careers | Join Yureka.One — India's Wealth OS",
    description:
      "Help build India's first AI-native Wealth Operating System. Explore open roles at Yureka.One across engineering, AI, design, and growth.",
    keywords: ['yureka careers', 'fintech jobs india 2026', 'wealth OS startup hiring'],
  },
  '/yureka-ai': {
    title: 'Yureka AI: The Shopping Agent That Orders & Earns For You',
    description:
      "An AI concierge on Swiggy MCP that compares prices, picks the best-reward payment, places your food & grocery orders, and pays you in Yureka Goldback.",
    keywords: [
      'AI shopping agent india', 'order Swiggy through AI', 'how to order food using AI india',
      'agentic commerce app india', 'AI shopping assistant india', 'Swiggy MCP agent',
    ],
  },
  '/join-waitlist': {
    title: 'Join Yureka — Earn Gold on Every Order | Yureka.One',
    description:
      "Get early access to Yureka.One — India's AI Wealth OS. Earn Yureka Goldback on every transaction, order via AI concierge, and build credit automatically. Invite-gated access.",
    keywords: [
      'yureka waitlist', 'join yureka one', 'early access AI wealth app india',
      'earn gold on spending app india',
    ],
  },
  '/login': {
    title: 'Sign In | Yureka.One',
    description: 'Sign in to your Yureka.One account to track Goldback rewards, manage your AI concierge, and access your personalized dashboard.',
    robots: 'noindex, follow',
  },
  '/reset-password': {
    title: 'Reset Password | Yureka.One',
    description: 'Reset your password for Yureka.One.',
    robots: 'noindex, follow',
  },
  '/waiting': {
    title: 'Waitlist Status | Yureka.One',
    description: 'Check the status of your Yureka.One waitlist application.',
    robots: 'noindex, follow',
  },
  '/admin': {
    title: 'Admin | Yureka.One',
    description: 'Internal administration console.',
    robots: 'noindex, nofollow',
  },
  '/brand': {
    title: 'Brand portal | Yureka.One',
    description: 'Invite-only partner portal to publish offers and see how members interact with them.',
    robots: 'noindex, nofollow',
  },
  '/ww': {
    title: 'WanderWorld ops | Yureka.One',
    description: 'Invite-only WanderWorld trips admin and promoter portal.',
    robots: 'noindex, nofollow',
  },
  '/ww/login': {
    title: 'WanderWorld login | Yureka.One',
    description: 'Sign in to WanderWorld ops.',
    robots: 'noindex, nofollow',
  },
  '/ww/signup': {
    title: 'WanderWorld signup | Yureka.One',
    description: 'Create a WanderWorld ops account (invite required).',
    robots: 'noindex, nofollow',
  },
  '/ww/reset-password': {
    title: 'WanderWorld reset password | Yureka.One',
    description: 'Reset your WanderWorld ops password.',
    robots: 'noindex, nofollow',
  },

  // --- Future pages (serve correct meta even before page components are built) ---
  '/goldback': {
    title: 'Yureka Goldback: Cashback That Becomes 24K Digital Gold',
    description:
      "Why settle for expiring points? Yureka converts rewards on every order into yield-generating 24K digital gold — up to 16% effective ROI. Unified, liquid, automatic.",
    ogTitle: 'Yureka Goldback — Cashback That Becomes Gold',
    ogDescription:
      'Every transaction earns Yureka Goldback: 24K digital gold that appreciates instead of expiring. Up to 16% effective returns on your everyday spending.',
    keywords: [
      'convert cashback to gold india', 'app that converts cashback to digital gold',
      'earn gold on spending india', 'gold rewards on UPI india', 'which app gives gold instead of cashback',
      'is cashback in gold better than cash cashback', 'best app to save gold automatically',
      'digital gold SIP from rupee 10', '16% ROI gold rewards', 'yureka goldback',
      'gold cashback india', 'pay with rewards india',
    ],
  },
  '/credit': {
    title: 'Build Credit From Your Spending | Yureka.One',
    description:
      "No credit history? Your UPI and shopping transactions can build it. Yureka creates RBI-compliant alternative credit profiles from consented data for thin-file users.",
    keywords: [
      'build credit from spending india', 'build credit without credit card india',
      'alternative credit score thin file', 'can UPI transactions improve credit score',
      'how to get credit score without credit card india', 'bina credit card ke CIBIL score',
      'rent payment to build credit india', 'LSP lending service provider india',
    ],
  },
  '/business': {
    title: 'Partner With Yureka | Smart Checkout, Ads & Credit Data',
    description:
      "Cut RTO and COD failures with smart checkout, run intent-based campaigns via Yureka AI, and access consent-first alternative credit signals for lending decisions.",
    keywords: [
      'smart checkout india reduce RTO', 'COD failure reduction', 'intent-based ads fintech india',
      'alternative credit data for lenders india', 'fintech B2B partnership india',
    ],
  },
  '/pricing': {
    title: 'Yureka Premium — ₹99/mo, 100% Reimbursed in Gold',
    description:
      "Yureka Premium costs ₹99/month or ₹1,199/year — and every rupee comes back to you as 24K digital gold. Membership that pays for itself, literally.",
    keywords: [
      'yureka premium pricing', 'subscription reimbursed as gold', 'fintech subscription india',
      'wealth app subscription india',
    ],
  },
  '/zwitch': {
    title: 'Zwitch | Premium Digital Agency',
    description: 'A premium, highly interactive, and visually stunning digital agency. Recreating future digital realities through design-led innovations.',
    keywords: ['digital agency', 'zwitch', 'interactive design', 'web development', 'creative agency'],
  },
};
