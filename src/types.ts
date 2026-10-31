export interface Source {
  title: string;
  publisher?: string | null;
  url: string;
  published_at?: string | null;
  accessed_at?: string | null;
  status?: string;
  rights_status?: string;
  id?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
}

export interface ContentItem {
  id: number;
  title: string;
  slug: string;
  summary: string;
  body?: string;
  status?: string;
  version?: number;
  category?: Category | null;
  category_id?: number;
  reviewed_at?: string | null;
  review_due_at?: string | null;
  sources: Source[];
}

export interface HealthService {
  id: number;
  name: string;
  service_type: string;
  description?: string | null;
  city: string;
  region?: string | null;
  address?: string | null;
  phone?: string | null;
  opening_hours?: string | null;
  audience?: string | null;
  accessibility?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  verified_at: string | null;
  status?: string;
  is_active?: boolean;
}

export interface AssistantMatch {
  title: string;
  excerpt: string;
  slug: string;
  sources: Source[];
  reviewed_at?: string | null;
}

export type AssistantMode = 'corpus_only' | 'ai_grounded' | 'safety_redirect' | 'unavailable';

export interface AssistantAnswer {
  request_id: string;
  mode: AssistantMode;
  message: string;
  matches: AssistantMatch[];
  citations: { title: string; publisher?: string | null; url: string; content_title?: string }[];
  abstained: boolean;
  disclaimer: string;
}

export interface AssistantResponse {
  data: AssistantAnswer;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

export type FeedbackCategory =
  | 'incorrect_info'
  | 'inappropriate'
  | 'source_unreachable'
  | 'service_unreachable'
  | 'safety_risk'
  | 'other';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active?: boolean;
  permissions: string[];
}
