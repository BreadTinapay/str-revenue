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
  last_contacted_at: string | null;
  is_suppressed: boolean;
  suppression_reason: string | null;
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
  markets?: string[]; // each formatted "City, State"
  confidence?: string[];
}

function toQueryString(filters: LeadFilters): string {
  const params = new URLSearchParams();
  for (const market of filters.markets ?? []) params.append("market", market);
  for (const c of filters.confidence ?? []) params.append("confidence", c);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface Market {
  city: string;
  state: string;
  label: string;
}

export function fetchMarkets(): Promise<Market[]> {
  return request(`/leads/markets`);
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

export interface LeadSendHistoryEntry {
  id: string;
  campaign_id: string;
  campaign_name: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export function fetchLeadSendHistory(id: string): Promise<LeadSendHistoryEntry[]> {
  return request(`/leads/${id}/sends`);
}

export interface JobStatus {
  status: "queued" | "started" | "finished" | "failed" | "not_found";
  result: unknown;
}

export function triggerDiscovery(city: string, state: string): Promise<{ job_id: string }> {
  return request(`/discovery/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, state }),
  });
}

export function getDiscoveryJob(jobId: string): Promise<JobStatus> {
  return request(`/discovery/jobs/${jobId}`);
}

export function triggerEnrichment(city: string, state: string): Promise<{ job_id: string }> {
  return request(`/enrichment/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, state }),
  });
}

export function getEnrichmentJob(jobId: string): Promise<JobStatus> {
  return request(`/enrichment/jobs/${jobId}`);
}

export function triggerDedup(city: string, state: string): Promise<{ job_id: string }> {
  return request(`/leads/dedup/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, state }),
  });
}

export function getDedupJob(jobId: string): Promise<JobStatus> {
  return request(`/leads/dedup/jobs/${jobId}`);
}

export async function pollJob(
  getJob: (id: string) => Promise<JobStatus>,
  jobId: string,
  { maxAttempts = 150, intervalMs = 2000 } = {},
): Promise<JobStatus> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const job = await getJob(jobId);
    if (job.status === "finished" || job.status === "failed" || job.status === "not_found") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { status: "failed", result: "Polling timeout exceeded" };
}

export interface Campaign {
  id: string;
  name: string;
  subject_template: string;
  body_html_template: string;
  target_filter: { city?: string; state?: string; confidence?: string } | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  matching_lead_count: number;
}

export interface CampaignSend {
  id: string;
  lead_id: string;
  email: string;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
}

export interface CampaignCreateRequest {
  name: string;
  subject_template: string;
  body_html_template: string;
  target_filter?: { city?: string; state?: string; confidence?: string };
}

export function fetchCampaigns(): Promise<Campaign[]> {
  return request(`/campaigns`);
}

export function fetchCampaign(id: string): Promise<Campaign> {
  return request(`/campaigns/${id}`);
}

export function fetchCampaignSends(id: string): Promise<CampaignSend[]> {
  return request(`/campaigns/${id}/sends`);
}

export interface CampaignTargetLead {
  id: string;
  canonical_name: string;
  city: string;
  state: string;
  best_email: string | null;
  best_confidence_score: string;
  excluded: boolean;
  is_suppressed: boolean;
  suppression_reason: string | null;
}

export function fetchCampaignTargets(id: string): Promise<CampaignTargetLead[]> {
  return request(`/campaigns/${id}/targets`);
}

export function excludeCampaignLead(campaignId: string, leadId: string): Promise<{ status: string }> {
  return request(`/campaigns/${campaignId}/exclude/${leadId}`, { method: "POST" });
}

export function includeCampaignLead(campaignId: string, leadId: string): Promise<{ status: string }> {
  return request(`/campaigns/${campaignId}/include/${leadId}`, { method: "POST" });
}

export function createCampaign(payload: CampaignCreateRequest): Promise<Campaign> {
  return request(`/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function sendCampaign(id: string): Promise<{ job_id: string }> {
  return request(`/campaigns/${id}/send`, { method: "POST" });
}

export function getCampaignJob(jobId: string): Promise<JobStatus> {
  return request(`/campaigns/jobs/${jobId}`);
}

export interface AppUser {
  id: string;
  email: string;
  role: "admin" | "viewer";
  created_at: string;
}

export function fetchUsers(): Promise<AppUser[]> {
  return request(`/users`);
}

export function fetchMe(): Promise<AppUser> {
  return request(`/users/me`);
}

export function createUser(payload: { email: string; password: string; role: string }): Promise<AppUser> {
  return request(`/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateUserRole(userId: string, role: string): Promise<AppUser> {
  return request(`/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export function deleteUser(userId: string): Promise<{ status: string }> {
  return request(`/users/${userId}`, { method: "DELETE" });
}

export function resetUserPassword(userId: string, newPassword: string): Promise<{ status: string }> {
  return request(`/users/${userId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export function changeOwnPassword(currentPassword: string, newPassword: string): Promise<{ status: string }> {
  return request(`/users/me/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export interface AuditLogEntry {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function fetchAuditLog(): Promise<AuditLogEntry[]> {
  return request(`/audit-log`);
}

export interface UsState {
  code: string;
  name: string;
}

export function fetchStates(): Promise<UsState[]> {
  return request(`/geo/states`);
}

export function fetchCities(state: string, q?: string, offset?: number): Promise<{ cities: string[]; total: number }> {
  const params = new URLSearchParams({ state });
  if (q) params.set("q", q);
  if (offset && offset > 0) params.set("offset", String(offset));
  return request(`/geo/cities?${params.toString()}`);
}

export interface AppSettings {
  company_physical_address: string;
  email_from_name: string;
  email_from_address: string;
  email_reply_to: string | null;
}

export function fetchSettings(): Promise<AppSettings> {
  return request(`/settings`);
}

export function updateSettings(payload: AppSettings): Promise<AppSettings> {
  return request(`/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
