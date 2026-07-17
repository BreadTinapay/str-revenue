import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db import Base


class MarketListing(Base):
    """Raw Phase 1 discovery output. Read-only public data: names + pricing only.

    No guest info, host email/phone, exact addresses, or calendar/availability
    beyond what's shown on the public listing page.
    """

    __tablename__ = "market_listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id = Column(String, nullable=False, index=True)  # Airbnb's public listing id
    host_display_name = Column(String, nullable=False, index=True)
    property_type = Column(String, nullable=True)
    nightly_price = Column(Float, nullable=True)
    currency = Column(String, default="USD")
    city = Column(String, nullable=False, index=True)
    state = Column(String, nullable=False, index=True)
    neighborhood = Column(String, nullable=True)
    amenities_summary = Column(Text, nullable=True)
    source_url = Column(String, nullable=False)
    scraped_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Contact(Base):
    """Phase 2 enrichment output. Sourced from web search + the business's own
    website/socials — never from Airbnb. Linked back to the market_listings row
    that supplied the host/company name being enriched.
    """

    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    market_listing_id = Column(UUID(as_uuid=True), ForeignKey("market_listings.id"), nullable=False, index=True)

    candidate_name = Column(String, nullable=False)  # host_display_name at enrichment time
    website_url = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    social_links = Column(JSONB, nullable=True)  # {"facebook": url, "instagram": url, ...}

    confidence_score = Column(String, nullable=False)  # "high" | "low" | "none"
    email_source_url = Column(String, nullable=True)  # provenance: exact page the email was found on
    search_query_used = Column(String, nullable=True)  # provenance: query that surfaced the candidate site

    enriched_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Lead(Base):
    """Phase 3 deduplicated, merged view. A lead aggregates one or more
    market_listings (and their contacts) that are believed to be the same
    real-world host/company, matched by exact email/phone or fuzzy name
    similarity within the same city/state.
    """

    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    canonical_name = Column(String, nullable=False, index=True)
    city = Column(String, nullable=False, index=True)
    state = Column(String, nullable=False, index=True)

    best_email = Column(String, nullable=True)
    best_phone = Column(String, nullable=True)
    best_website = Column(String, nullable=True)
    best_confidence_score = Column(String, nullable=False, default="none")

    listing_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class LeadSource(Base):
    """Join table: which raw market_listings/contacts compose a given lead.
    Never delete or overwrite a row here — it's part of the provenance trail.
    """

    __tablename__ = "lead_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    market_listing_id = Column(UUID(as_uuid=True), ForeignKey("market_listings.id"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class MergeLog(Base):
    """Audit trail for every dedup decision — including "new_lead" decisions —
    so merges are always explainable after the fact, never silent.
    """

    __tablename__ = "merge_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    market_listing_id = Column(UUID(as_uuid=True), ForeignKey("market_listings.id"), nullable=False)
    match_type = Column(String, nullable=False)  # "exact_email" | "exact_phone" | "fuzzy_name" | "new_lead"
    similarity_score = Column(Float, nullable=True)  # populated for fuzzy_name matches
    merged_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="viewer")  # "admin" | "viewer"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SuppressionEntry(Base):
    """Emails that must never receive a send: unsubscribes, hard bounces, spam
    complaints, manual opt-outs. Checked before every single send, including
    manual/test sends — no exceptions.
    """

    __tablename__ = "suppression_list"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, unique=True, index=True)
    reason = Column(String, nullable=False)  # "unsubscribe" | "hard_bounce" | "complaint" | "manual"
    source = Column(String, nullable=True)  # e.g. campaign_send id or "manual:<admin email>"
    suppressed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    subject_template = Column(String, nullable=False)
    body_html_template = Column(Text, nullable=False)
    # Filter used to select target leads at send time (city/state/confidence).
    target_filter = Column(JSONB, nullable=True)
    status = Column(String, nullable=False, default="draft")  # draft | sending | completed
    scheduled_at = Column(DateTime, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CampaignSend(Base):
    """One row per lead targeted by a campaign — the audit trail of what was
    (or wasn't) sent, and why.
    """

    __tablename__ = "campaign_sends"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    email = Column(String, nullable=False)

    status = Column(String, nullable=False, default="pending")  # pending|sent|suppressed|failed|bounced
    provider = Column(String, nullable=True)  # "ses" | "resend"
    provider_message_id = Column(String, nullable=True)
    unsubscribe_token = Column(String, nullable=False, unique=True, index=True)
    error_message = Column(Text, nullable=True)

    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class EmailEvent(Base):
    """Opens/clicks/bounces/complaints reported back by the provider webhook."""

    __tablename__ = "email_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_send_id = Column(UUID(as_uuid=True), ForeignKey("campaign_sends.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # delivered|open|click|bounce|complaint
    raw_payload = Column(JSONB, nullable=True)
    occurred_at = Column(DateTime, default=datetime.utcnow, nullable=False)
