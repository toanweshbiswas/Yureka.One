/**
 * Converts Java API responses (camelCase, JSONB as JSON strings) to the
 * existing component-facing types (snake_case, parsed arrays).
 * This lets all consumers of SupabaseProvider and direct-fetch components
 * continue using the same field names throughout Phase 2 to 4 of the migration.
 */

import type {
  Card as ApiCard,
  Blog as ApiBlog,
  Review as ApiReview,
  Waitlist as ApiWaitlist,
} from './types'

import type { Card, Blog, Review, WaitlistEntry } from '@/types'

function safeJsonParse<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback
  try { return JSON.parse(str) as T }
  catch { return fallback }
}


export function fromApiCard(c: ApiCard): Card {
  return {
    id: c.id,
    name: c.name,
    bank: c.bank,
    issuer: c.issuer,
    type: c.type,
    image: c.image,
    rating: c.rating,
    benefits: c.benefits ?? [],
    annual_fee: c.annualFee,
    joining_fee: c.joiningFee,
    best_for: c.bestFor,
    color: c.color,
    rewards_rate: c.rewardsRate,
    category: c.category,
    projected_savings: c.projectedSavings,
    intro_offer: c.introOffer,
    tags: c.tags,
    elite_rating: c.eliteRating,
    benefit_items: safeJsonParse(c.benefitItems, []),
    verdict: c.verdict,
    slug: c.slug,
    categories: c.categories,
    apply_link: c.applyLink,
    status: c.status,
    description: c.description,
    updated_on: c.updatedOn,
    author: c.author,
    reward_type: c.rewardType,
    welcome_benefits: c.welcomeBenefits,
    product_details: c.productDetails,
    pros: c.pros,
    cons: c.cons,
    detailed_features: safeJsonParse(c.detailedFeatures, []),
    cashback_details: c.cashbackDetails,
    redemption_table: safeJsonParse(c.redemptionTable, []),
    exclusions: c.exclusions,
    eligibility_criteria: safeJsonParse(c.eligibilityCriteria, []),
    comparison_cards: c.comparisonCards,
    latest_news: c.latestNews,
    final_review_image: c.finalReviewImage,
    final_verdict_text: c.finalVerdictText,
    grid_benefits: safeJsonParse(c.gridBenefits, []),
    grid_fees: safeJsonParse(c.gridFees, []),
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }
}

export function fromApiBlog(b: ApiBlog): Blog {
  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    excerpt: b.excerpt,
    content: b.content,
    author: b.author,
    category: b.category,
    image: b.image,
    external_link: b.externalLink,
    date: b.date,
    featured: b.featured,
    read_time: b.readTime,
    status: b.status,
    scheduled_at: b.scheduledAt,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    content_format: b.contentFormat,
  }
}

export function fromApiWaitlist(w: ApiWaitlist): WaitlistEntry {
  const statusRaw = w.status === 'on_hold' || w.status === 'on-hold' ? 'on-hold' : w.status
  return {
    id: w.id,
    name: w.name,
    first_name: w.firstName,
    last_name: w.lastName,
    email: w.email,
    phone: w.phone,
    mobile_number: w.mobileNumber,
    date_of_birth: w.dateOfBirth,
    gender: w.gender,
    role: (w.role as 'user' | 'partner') ?? 'user',
    category: w.category,
    company: w.company,
    credit_cards_count: w.creditCardsCount,
    credit_cards_details: safeJsonParse(w.creditCardsDetails, []),
    most_used_for: w.mostUsedFor,
    monthly_spend: w.monthlySpend,
    referral_code: w.referralCode,
    personal_referral_code: w.personalReferralCode,
    source_channel: w.sourceChannel,
    rank: w.rank,
    status: (statusRaw as WaitlistEntry['status']) ?? 'pending',
    joined_at: w.joinedAt,
    created_at: w.createdAt,
  }
}

export function fromApiReview(r: ApiReview): Review {
  return {
    id: r.id,
    author: r.author,
    role: r.role,
    company: r.company,
    company_logo: r.companyLogo,
    avatar: r.avatar,
    image: r.image,
    quote: r.quote,
    rating: r.rating,
    source: r.source,
    featured: r.featured,
    rotation: r.rotation,
    status: r.status,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }
}
