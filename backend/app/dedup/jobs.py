import logging
from collections import defaultdict

from sqlalchemy import desc

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

        if not pending:
            logger.info("Dedup run for %s, %s: no pending listings", city, state)
            return 0

        pending_ids = [listing.id for listing in pending]

        contact_rows = (
            db.query(Contact)
            .filter(Contact.market_listing_id.in_(pending_ids))
            .order_by(desc(Contact.enriched_at))
            .all()
        )

        latest_contact: dict = {}
        for contact in contact_rows:
            if contact.market_listing_id not in latest_contact:
                latest_contact[contact.market_listing_id] = contact

        listing_map = {listing.id: listing for listing in pending}

        processed = 0
        for listing_id in pending_ids:
            listing = listing_map[listing_id]
            contact = latest_contact.get(listing_id)
            match_and_merge(db, listing, contact)
            processed += 1
            db.commit()

        logger.info("Dedup run for %s, %s processed %d listings", city, state, processed)
        return processed
    finally:
        db.close()
