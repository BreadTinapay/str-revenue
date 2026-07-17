import logging

from app.db import SessionLocal
from app.dedup.matcher import match_and_merge
from app.models import Contact, LeadSource, MarketListing

logger = logging.getLogger(__name__)


def run_deduplication(city: str, state: str) -> int:
    """RQ job: process every market_listings row for a market that hasn't yet
    been assigned to a lead. Returns the number of listings processed.
    """
    db = SessionLocal()
    try:
        already_processed_ids = {
            row[0] for row in db.query(LeadSource.market_listing_id).all()
        }

        listings = (
            db.query(MarketListing)
            .filter(MarketListing.city == city, MarketListing.state == state)
            .all()
        )
        pending = [listing for listing in listings if listing.id not in already_processed_ids]

        processed = 0
        for listing in pending:
            contact = (
                db.query(Contact)
                .filter(Contact.market_listing_id == listing.id)
                .order_by(Contact.enriched_at.desc())
                .first()
            )
            match_and_merge(db, listing, contact)
            processed += 1
            db.commit()

        logger.info("Dedup run for %s, %s processed %d listings", city, state, processed)
        return processed
    finally:
        db.close()
