from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: UUID
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreateRequest(BaseModel):
    email: str
    password: str
    role: str = "viewer"


class UserRoleUpdateRequest(BaseModel):
    role: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    new_password: str


class AppSettingsOut(BaseModel):
    company_physical_address: str
    email_from_name: str
    email_from_address: str
    email_reply_to: str | None


class AppSettingsUpdateRequest(BaseModel):
    company_physical_address: str
    email_from_name: str
    email_from_address: str
    email_reply_to: str | None = None


class AuditLogEntryOut(BaseModel):
    id: UUID
    actor_email: str | None
    action: str
    entity_type: str | None
    entity_id: str | None
    details: dict | None
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class DiscoveryRunRequest(BaseModel):
    city: str
    state: str
    max_pages: int = 5


class EnrichmentRunRequest(BaseModel):
    city: str
    state: str


class ContactOut(BaseModel):
    id: UUID
    market_listing_id: UUID
    candidate_name: str
    website_url: str | None
    email: str | None
    phone: str | None
    social_links: dict | None
    confidence_score: str
    email_source_url: str | None
    search_query_used: str | None
    enriched_at: datetime

    class Config:
        from_attributes = True


class DedupRunRequest(BaseModel):
    city: str
    state: str


class LeadOut(BaseModel):
    id: UUID
    canonical_name: str
    city: str
    state: str
    best_email: str | None
    best_phone: str | None
    best_website: str | None
    best_confidence_score: str
    listing_count: int
    last_contacted_at: datetime | None = None
    is_suppressed: bool = False
    suppression_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MergeLogEntryOut(BaseModel):
    id: UUID
    market_listing_id: UUID
    match_type: str
    similarity_score: float | None
    merged_at: datetime

    class Config:
        from_attributes = True


class MarketListingOut(BaseModel):
    id: UUID
    listing_id: str
    host_display_name: str
    property_type: str | None
    nightly_price: float | None
    currency: str
    city: str
    state: str
    neighborhood: str | None
    amenities_summary: str | None
    source_url: str
    scraped_at: datetime

    class Config:
        from_attributes = True


class LeadDetailOut(LeadOut):
    merge_history: list[MergeLogEntryOut]
    source_listings: list[MarketListingOut]


class LeadsOverTimePoint(BaseModel):
    day: date
    count: int


class MarketCoveragePoint(BaseModel):
    city: str
    state: str
    lead_count: int
    listing_count: int


class AnalyticsOverviewOut(BaseModel):
    total_listings: int
    total_contacts: int
    total_leads: int
    enrichment_match_rate: float  # high+low / total contacts attempted
    high_confidence_rate: float  # high / total contacts attempted
    leads_over_time: list[LeadsOverTimePoint]
    market_coverage: list[MarketCoveragePoint]


class CampaignCreateRequest(BaseModel):
    name: str
    subject_template: str
    body_html_template: str
    target_filter: dict | None = None


class CampaignOut(BaseModel):
    id: UUID
    name: str
    subject_template: str
    body_html_template: str
    target_filter: dict | None
    status: str
    scheduled_at: datetime | None
    created_at: datetime
    matching_lead_count: int = 0

    class Config:
        from_attributes = True


class CampaignTargetLeadOut(BaseModel):
    id: UUID
    canonical_name: str
    city: str
    state: str
    best_email: str | None
    best_confidence_score: str
    excluded: bool
    is_suppressed: bool
    suppression_reason: str | None = None


class CampaignSendOut(BaseModel):
    id: UUID
    lead_id: UUID
    email: str
    status: str
    provider: str | None
    provider_message_id: str | None
    error_message: str | None
    sent_at: datetime | None

    class Config:
        from_attributes = True


class LeadSendHistoryEntryOut(BaseModel):
    id: UUID
    campaign_id: UUID
    campaign_name: str
    subject: str
    status: str
    error_message: str | None
    sent_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True
