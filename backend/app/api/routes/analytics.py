from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.models import Contact, Lead, MarketListing

router = APIRouter()


@router.get("/overview", dependencies=[Depends(get_current_user)])
def get_analytics_overview(db: Session = Depends(get_db)):
    total_listings = db.query(func.count(MarketListing.id)).scalar()
    total_contacts = db.query(func.count(Contact.id)).scalar()
    total_leads = db.query(func.count(Lead.id)).scalar()

    confidence_counts = dict(
        db.query(Contact.confidence_score, func.count(Contact.id)).group_by(Contact.confidence_score).all()
    )
    high_count = confidence_counts.get("high", 0)
    low_count = confidence_counts.get("low", 0)

    match_rate = (high_count + low_count) / total_contacts if total_contacts else 0.0
    high_confidence_rate = high_count / total_contacts if total_contacts else 0.0

    leads_over_time_rows = (
        db.query(func.date(Lead.created_at).label("day"), func.count(Lead.id))
        .group_by(func.date(Lead.created_at))
        .order_by(func.date(Lead.created_at))
        .all()
    )
    leads_over_time = [{"day": row[0], "count": row[1]} for row in leads_over_time_rows]

    coverage_rows = (
        db.query(
            Lead.city,
            Lead.state,
            func.count(Lead.id),
        )
        .group_by(Lead.city, Lead.state)
        .all()
    )
    listing_counts = dict(
        (
            (row[0], row[1]),
            row[2],
        )
        for row in db.query(MarketListing.city, MarketListing.state, func.count(MarketListing.id))
        .group_by(MarketListing.city, MarketListing.state)
        .all()
    )
    market_coverage = [
        {
            "city": city,
            "state": state,
            "lead_count": lead_count,
            "listing_count": listing_counts.get((city, state), 0),
        }
        for city, state, lead_count in coverage_rows
    ]

    return {
        "total_listings": total_listings,
        "total_contacts": total_contacts,
        "total_leads": total_leads,
        "enrichment_match_rate": round(match_rate, 4),
        "high_confidence_rate": round(high_confidence_rate, 4),
        "leads_over_time": leads_over_time,
        "market_coverage": market_coverage,
    }
