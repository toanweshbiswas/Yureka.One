export interface Blog {
  id?: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  image: string;
  external_link?: string;
  date?: string;
  featured?: boolean;
  slug?: string;
  created_at?: string;
  updated_at?: string;
  read_time?: string;
  status?: 'draft' | 'published';
  scheduled_at?: string;
  content_format?: 'html' | 'markdown';
}

export interface Card {
  id?: string;
  name: string;
  bank: string;
  issuer?: string;
  type: string;
  image: string;
  rating: number;
  benefits: string[];
  annual_fee: string;
  joining_fee: string;
  best_for: string;
  color: string;
  rewards_rate?: string;
  category?: string;
  projected_savings?: string;
  intro_offer?: string;
  tags?: string[];
  elite_rating?: number;
  benefit_items?: { heading: string; subheading: string }[];
  verdict?: string;
  slug?: string;
  categories?: string[];
  apply_link?: string;
  created_at?: string;
  updated_at?: string;
  status?: 'draft' | 'published';
  
  // Enhanced review fields
  description?: string;
  updated_on?: string;
  author?: string;
  reward_type?: string;
  welcome_benefits?: string;
  product_details?: string[];
  pros?: string[];
  cons?: string[];
  detailed_features?: { title: string; content: string }[];
  cashback_details?: string[];
  redemption_table?: { category: string; value: string }[];
  exclusions?: string[];
  eligibility_criteria?: { criteria: string; salaried: string; self_employed: string }[];
  comparison_cards?: string[];
  latest_news?: string[];
  final_review_image?: string;
  final_verdict_text?: string;
  
  // Specific benefits grid
  grid_benefits?: { title: string; value: string }[];
  grid_fees?: { title: string; value: string }[];
}

export interface WaitlistEntry {
  id?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  mobile_number?: string;
  date_of_birth?: string;
  gender?: string;
  role: 'user' | 'partner';
  category?: string;
  company?: string;
  credit_cards_count?: number;
  credit_cards_details?: any[];
  most_used_for?: string;
  monthly_spend?: string;
  referral_code?: string;
  personal_referral_code?: string;
  source_channel?: string;
  rank?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'on_hold' | 'on-hold';
  joined_at?: string;
  created_at?: string;
}

export interface OSFeature {
  id: string;
  name: string;
  issuer: string;
  image: string;
  rewards_rate: string;
  annual_fee: string;
  category: string;
  best_for: string;
  projected_savings?: string;
  features?: string[];
  status?: 'available' | 'coming_soon';
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface Testimonial {
  id: string;
  name: string;
  handle: string;
  content: string;
  avatar: string;
  image?: string;
  date: string;
  likes: number;
}

export interface Review {
  id?: string;
  author: string;
  role: string;
  company: string;
  company_logo?: string;
  avatar?: string;
  image: string;
  quote: string;
  rating?: number;
  source?: 'App Store' | 'Google Play' | 'Direct';
  featured?: boolean;
  rotation?: number;
  status?: 'draft' | 'published';
  created_at?: string;
  updated_at?: string;
}

export interface NewsletterEntry {
  id?: string;
  email: string;
  status: 'active' | 'unsubscribed';
  subscribed_at?: string;
  created_at?: string;
}