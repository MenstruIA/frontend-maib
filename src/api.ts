import type {
  AdminUser, AssistantResponse, Category, ContentItem, FeedbackCategory, HealthService, Paginated, Source,
} from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;
  constructor(message: string, status: number, fields: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit & { token?: string | null }): Promise<T> {
  const { token, ...rest } = init ?? {};
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
    });
  } catch {
    throw new ApiError('Connexion impossible. Vérifiez votre réseau et réessayez.', 0);
  }

  if (!response.ok) {
    let body: { message?: string; errors?: Record<string, string[]>; error?: { message?: string } } = {};
    try { body = await response.json(); } catch { /* corps non JSON */ }
    const fields = body.errors ?? {};
    const detail = body.error?.message ?? body.message;
    if (response.status === 401) throw new ApiError('Session expirée. Reconnectez-vous.', 401);
    if (response.status === 403) throw new ApiError('Action non autorisée pour votre rôle.', 403);
    if (response.status === 422) throw new ApiError(detail || 'La demande n’a pas pu être validée.', 422, fields);
    if (response.status === 429) throw new ApiError('Trop de demandes en peu de temps. Réessayez dans un instant.', 429);
    if (response.status >= 500) throw new ApiError('Le service est temporairement indisponible.', response.status);
    throw new ApiError('Impossible de récupérer les informations demandées.', response.status);
  }
  return response.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  categories: () => request<{ data: Category[] }>('/categories'),
  content: (params: { q?: string; category?: string } = {}) => request<Paginated<ContentItem>>(`/content${qs(params)}`),
  contentBySlug: (slug: string) => request<{ data: ContentItem }>(`/content/${encodeURIComponent(slug)}`),
  services: (params: { q?: string; city?: string; type?: string } = {}) => request<Paginated<HealthService>>(`/services${qs(params)}`),
  ask: (question: string) => request<AssistantResponse>('/assistant/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  feedback: (payload: { category: FeedbackCategory; target_type?: string; target_ref?: string; description?: string }) =>
    request<{ data: { reference: string; message: string } }>('/feedback', { method: 'POST', body: JSON.stringify(payload) }),
};

/** Client d'administration : le jeton est passé explicitement (conservé en mémoire par l'appelant). */
export const adminApi = (token: string | null) => {
  const call = <T,>(path: string, method = 'GET', body?: unknown) =>
    request<T>(`/admin${path}`, { method, token, body: body === undefined ? undefined : JSON.stringify(body) });
  return {
    login: (email: string, password: string) =>
      request<{ data: { token: string; user: AdminUser } }>('/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => call<unknown>('/logout', 'POST'),
    me: () => call<{ data: AdminUser }>('/me'),
    content: (status?: string) => call<Paginated<ContentItem>>(`/content${qs({ status })}`),
    contentOne: (id: number) => call<{ data: ContentItem & { reviews?: { decision: string; notes?: string; content_version: number }[] } }>(`/content/${id}`),
    saveContent: (payload: Record<string, unknown>, id?: number) =>
      id ? call<{ data: ContentItem }>(`/content/${id}`, 'PATCH', payload) : call<{ data: ContentItem }>('/content', 'POST', payload),
    contentAction: (id: number, action: 'submit-review' | 'review' | 'publish' | 'withdraw', payload?: unknown) =>
      call<{ data: ContentItem }>(`/content/${id}/${action}`, 'POST', payload ?? {}),
    sources: () => call<Paginated<Source>>('/sources'),
    saveSource: (payload: Record<string, unknown>, id?: number) =>
      id ? call<{ data: Source }>(`/sources/${id}`, 'PATCH', payload) : call<{ data: Source }>('/sources', 'POST', payload),
    validateSource: (id: number, payload: Record<string, unknown>) => call<{ data: Source }>(`/sources/${id}/validate`, 'POST', payload),
    services: () => call<Paginated<HealthService>>('/services'),
    saveService: (payload: Record<string, unknown>, id?: number) =>
      id ? call<{ data: HealthService }>(`/services/${id}`, 'PATCH', payload) : call<{ data: HealthService }>('/services', 'POST', payload),
    verifyService: (id: number, payload: Record<string, unknown>) => call<{ data: HealthService }>(`/services/${id}/verify`, 'POST', payload),
    withdrawService: (id: number) => call<{ data: HealthService }>(`/services/${id}/withdraw`, 'POST', {}),
    feedback: () => call<Paginated<{ id: number; public_id: string; category: string; target_type?: string; target_ref?: string; description?: string; severity: string; status: string }>>('/feedback'),
    updateFeedback: (id: number, status: string) => call<unknown>(`/feedback/${id}`, 'PATCH', { status }),
    assistant: () => call<{ data: { enabled_switch: boolean; provider_configured: boolean } }>('/assistant'),
    setAssistant: (enabled: boolean) => call<{ data: { enabled_switch: boolean; provider_configured: boolean } }>('/assistant', 'PUT', { enabled }),
    users: () => call<AdminUser[]>('/users'),
    createUser: (payload: Record<string, unknown>) => call<unknown>('/users', 'POST', payload),
    updateUser: (id: number, payload: Record<string, unknown>) => call<unknown>(`/users/${id}`, 'PATCH', payload),
    reports: () => call<{ data: Record<string, Record<string, number> | number | { mode: string; total: number | null }[]> }>('/reports'),
    audit: () => call<Paginated<{ id: number; action: string; entity_type: string; entity_id?: number; user_id?: number; created_at: string }>>('/audit'),
  };
};
