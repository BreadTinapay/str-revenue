from sqlalchemy import func
from sqlalchemy.orm import Query, Session

from app.models import CampaignExclusion, Lead, SuppressionEntry


def apply_target_filter(query: Query, target_filter: dict | None) -> Query:
    target_filter = target_filter or {}
    if target_filter.get("city"):
        query = query.filter(Lead.city.ilike(target_filter["city"]))
    if target_filter.get("state"):
        query = query.filter(Lead.state.ilike(target_filter["state"]))
    if target_filter.get("confidence"):
        query = query.filter(Lead.best_confidence_score == target_filter["confidence"])
    return query


def matching_leads_query(db: Session, target_filter: dict | None) -> Query:
    """Leads matching a campaign's target filter and eligible to be targeted
    at all (has an email). Does NOT filter out manual exclusions or
    suppressed addresses — those are handled separately so the send job can
    still write an auditable campaign_send row explaining why a matching
    lead didn't actually get emailed.
    """
    query = db.query(Lead).filter(Lead.best_email.isnot(None))
    return apply_target_filter(query, target_filter)


def excluded_lead_ids(db: Session, campaign_id) -> set:
    return {
        row[0]
        for row in db.query(CampaignExclusion.lead_id).filter(CampaignExclusion.campaign_id == campaign_id).all()
    }


def suppressed_emails_lower(db: Session, emails: list[str] | None = None) -> set:
    """Return suppressed emails as a set. If emails is provided, only check
    those specific emails (much faster for targeted lookups).
    """
    if emails:
        lowered = {e.lower() for e in emails if e}
        if not lowered:
            return set()
        return {
            row[0].lower()
            for row in db.query(SuppressionEntry.email)
            .filter(func.lower(SuppressionEntry.email).in_(lowered))
            .all()
        }
    return {row[0].lower() for row in db.query(SuppressionEntry.email).all()}


def sendable_lead_count(db: Session, target_filter: dict | None, campaign_id) -> int:
    """How many leads will actually receive an email if sent right now —
    matches the filter, not manually excluded, not suppressed.
    Uses SQL count instead of loading all lead objects.
    """
    from sqlalchemy import func as sqlfunc

    query = matching_leads_query(db, target_filter)
    query = query.filter(~Lead.id.in_(db.query(CampaignExclusion.lead_id).filter(CampaignExclusion.campaign_id == campaign_id)))
    query = query.filter(sqlfunc.lower(Lead.best_email).notin_(
        db.query(sqlfunc.lower(SuppressionEntry.email))
    ))
    return query.count()
