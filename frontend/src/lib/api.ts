const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "str_revenue_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const resp = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!resp.ok) {
    if (resp.status === 401) clearToken();
    const body = await resp.text();
    throw new ApiError(resp.status, body || resp.statusText);
  }

  const contentType = resp.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return resp.json();
  }
  return resp as unknown as T;
}

export async function login(email: string, password: string): Promise<{ access_token: string; role: string }> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const resp = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    throw new ApiError(resp.status, "Invalid email or password");
  }
  return resp.json();
}

export interface Lead {
  id: string;
  canonical_name: string;
  city: string;
  state: string;
  best_email: string | null;
  best_phone: string | null;
  best_website: string | null;
  best_confidence_score: "high" | "low" | "none";
  listing_count: number;
  created_at: string;
  updated_at: string;
}

export interface MarketListing {
  id: string;
  listing_id: string;
  host_display_name: string;
  property_type: string | null;
  nightly_price: number | null;
  currency: string;
  city: string;
  state: string;
  neighborhood: string | null;
  amenities_summary: string | null;
  source_url: string;
  scraped_at: string;
}

export interface MergeLogEntry {
  id: string;
  market_listing_id: string;
  match_type: string;
  similarity_score: number | null;
  merged_at: string;
}

export interface LeadDetail extends Lead {
  merge_history: MergeLogEntry[];
  source_listings: MarketListing[];
}

export interface AnalyticsOverview {
  total_listings: number;
  total_contacts: number;
  total_leads: number;
  enrichment_match_rate: number;
  high_confidence_rate: number;
  leads_over_time: { day: string; count: number }[];
  market_coverage: { city: string; state: string; lead_count: number; listing_count: number }[];
}

export interface LeadFilters {
  city?: string;
  state?: string;
  confidence?: string;
}

function toQueryString(filters: LeadFilters): string {
  const params = new URLSearchParams();
  if (filters.city) params.set("city", filters.city);
  if (filters.state) params.set("state", filters.state);
  if (filters.confidence) params.set("confidence", filters.confidence);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchLeads(filters: LeadFilters): Promise<Lead[]> {
  return request(`/leads${toQueryString(filters)}`);
}

export function fetchLeadDetail(id: string): Promise<LeadDetail> {
  return request(`/leads/${id}`);
}

export function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  return request(`/analytics/overview`);
}

export async function downloadLeadsCsv(filters: LeadFilters): Promise<void> {
  const token = getToken();
  const resp = await fetch(`${API_URL}/leads/export.csv${toQueryString(filters)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new ApiError(resp.status, "Failed to export CSV");

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "leads.csv";
  link.click();
  URL.revokeObjectURL(url);
}
