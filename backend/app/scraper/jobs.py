import logging

from app.db import SessionLocal
from app.models import MarketListing
from app.scraper.extractors.searxng_discovery import SearxngDiscoveryExtractor

logger = logging.getLogger(__name__)


def run_discovery(city: str, state: str, max_pages: int = 3) -> int:
    """RQ job: discover listings for a market and persist new rows.

    Returns the number of listings written.
    """
    db = SessionLocal()
    try:
        known_listing_ids = {
            row[0]
            for row in db.query(MarketListing.listing_id)
            .filter(MarketListing.city == city, MarketListing.state == state)
            .all()
        }

        extractor = SearxngDiscoveryExtractor(known_listing_ids=known_listing_ids)
        discovered = extractor.discover(city=city, state=state, max_pages=max_pages)

        written = 0
        for item in discovered:
            db.add(
                MarketListing(
                    listing_id=item.listing_id,
                    host_display_name=item.host_display_name,
                    property_type=item.property_type,
                    nightly_price=item.nightly_price,
                    currency=item.currency,
                    city=item.city,
                    state=item.state,
                    neighborhood=item.neighborhood,
                    amenities_summary=item.amenities_summary,
                    source_url=item.source_url,
                )
            )
            written += 1
        db.commit()
        logger.info("Discovery run for %s, %s wrote %d rows", city, state, written)
        return written
    finally:
        db.close()
