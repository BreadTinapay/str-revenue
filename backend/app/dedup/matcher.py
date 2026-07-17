import uuid
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Contact, Lead, LeadSource, MarketListing, MergeLog

# Trigram similarity threshold for treating two names as the same host/company
# within the same city/state. Below this, names that merely share a few
# characters (e.g. "Sam" vs "Samantha") would false-merge distinct hosts.
FUZZY_NAME_THRESHOLD = 0.5

CONFIDENCE_RANK = {"high": 2, "low": 1, "none": 0}


def match_and_merge(db: Session, listing: MarketListing, contact: Contact | None) -> Lead:
    """Find an existing lead this listing belongs to, or create a new one.

    Match priority: exact email > exact phone > fuzzy name (same city/state).
    Every decision — including creating a new lead — writes a merge_log row,
    so nothing is ever merged (or split) silently.
    """
    email = contact.email if contact else None
    phone = contact.phone if contact else None
    confidence = contact.confidence_score if contact else "none"

    lead, match_type, similarity_score = _find_match(db, listing, email, phone)

    if lead is None:
        lead = Lead(
            id=uuid.uuid4(),
            canonical_name=listing.host_display_name,
            city=listing.city,
            state=listing.state,
            best_email=email,
            best_phone=phone,
            best_website=contact.website_url if contact else None,
            best_confidence_score=confidence,
            listing_count=0,
        )
        db.add(lead)
        db.flush()
        match_type = "new_lead"
    elif CONFIDENCE_RANK.get(confidence, 0) > CONFIDENCE_RANK.get(lead.best_confidence_score, 0):
        # A better-quality contact came in for a lead we already have — update
        # the lead's "best" fields, but the prior source rows in lead_sources
        # / merge_log are untouched, so the earlier (weaker) data is still traceable.
        lead.best_email = email
        lead.best_phone = phone
        lead.best_website = contact.website_url if contact else lead.best_website
        lead.best_confidence_score = confidence
        lead.updated_at = datetime.utcnow()

    lead.listing_count += 1

    db.add(
        LeadSource(
            id=uuid.uuid4(),
            lead_id=lead.id,
            market_listing_id=listing.id,
            contact_id=contact.id if contact else None,
        )
    )
    db.add(
        MergeLog(
            id=uuid.uuid4(),
            lead_id=lead.id,
            market_listing_id=listing.id,
            match_type=match_type,
            similarity_score=similarity_score,
        )
    )

    return lead


def _find_match(
    db: Session, listing: MarketListing, email: str | None, phone: str | None
) -> tuple[Lead | None, str | None, float | None]:
    same_market = [Lead.city == listing.city, Lead.state == listing.state]

    if email:
        match = db.query(Lead).filter(*same_market, Lead.best_email == email).first()
        if match:
            return match, "exact_email", None

    if phone:
        match = db.query(Lead).filter(*same_market, Lead.best_phone == phone).first()
        if match:
            return match, "exact_phone", None

    # Airbnb search cards show only a bare first name (e.g. "Jennifer") with no
    # other distinguishing token. First names aren't unique, so fuzzy-matching
    # on a single word risks merging two unrelated hosts who share a name.
    # Only fuzzy-match names with enough signal to be a safe match (a full
    # name or company name — more than one token).
    if len(listing.host_display_name.split()) < 2:
        return None, None, None

    similarity = func.similarity(Lead.canonical_name, listing.host_display_name)
    multi_word_name = func.array_length(func.string_to_array(Lead.canonical_name, " "), 1) > 1
    match = (
        db.query(Lead)
        .filter(*same_market, multi_word_name, similarity > FUZZY_NAME_THRESHOLD)
        .order_by(similarity.desc())
        .first()
    )
    if match:
        score = db.query(similarity).filter(Lead.id == match.id).scalar()
        return match, "fuzzy_name", score

    return None, None, None
