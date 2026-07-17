import logging
import time

from app.db import SessionLocal
from app.enrichment.search import (
    SearchQuotaExceeded,
    extract_social_links,
    pick_primary_candidate,
    search,
)
from app.enrichment.website_parser import fetch_and_parse
from app.models import Contact, MarketListing

logger = logging.getLogger(__name__)

# Google CSE has a hard daily free-tier quota; a small pause between calls is
# plenty since we're calling an official API, not scraping search results.
DELAY_BETWEEN_SEARCHES_SECONDS = 1.0


def run_enrichment(city: str, state: str) -> int:
    """RQ job: enrich every market_listings row for a market that doesn't yet
    have a contact record. Returns the number of contacts written.
    """
    db = SessionLocal()
    try:
        already_enriched_ids = {row[0] for row in db.query(Contact.market_listing_id).all()}

        listings = (
            db.query(MarketListing)
            .filter(MarketListing.city == city, MarketListing.state == state)
            .all()
        )
        pending = [listing for listing in listings if listing.id not in already_enriched_ids]

        written = 0
        for listing in pending:
            contact = _enrich_listing(listing)
            db.add(contact)
            written += 1
            db.commit()
            time.sleep(DELAY_BETWEEN_SEARCHES_SECONDS)

        logger.info("Enrichment run for %s, %s wrote %d contact rows", city, state, written)
        return written
    finally:
        db.close()


def _enrich_listing(listing: MarketListing) -> Contact:
    query = f"{listing.host_display_name} {listing.city} {listing.state} short term rental"

    try:
        results = search(query)
    except SearchQuotaExceeded:
        logger.warning("Google CSE quota exceeded; skipping remaining enrichment for this run")
        return Contact(
            market_listing_id=listing.id,
            candidate_name=listing.host_display_name,
            confidence_score="none",
            search_query_used=query,
        )
    except Exception:
        logger.exception("Search failed for %s", listing.host_display_name)
        return Contact(
            market_listing_id=listing.id,
            candidate_name=listing.host_display_name,
            confidence_score="none",
            search_query_used=query,
        )

    social_links = extract_social_links(results)
    primary = pick_primary_candidate(results)

    if not primary:
        return Contact(
            market_listing_id=listing.id,
            candidate_name=listing.host_display_name,
            social_links=social_links or None,
            confidence_score="none",
            search_query_used=query,
        )

    parsed = fetch_and_parse(primary.url)

    # High confidence: email found directly on the candidate's own site.
    # Low confidence: only a phone number, or only social profiles, surfaced.
    if parsed.email:
        confidence = "high"
    elif parsed.phone or social_links:
        confidence = "low"
    else:
        confidence = "none"

    return Contact(
        market_listing_id=listing.id,
        candidate_name=listing.host_display_name,
        website_url=primary.url,
        email=parsed.email,
        phone=parsed.phone,
        social_links=social_links or None,
        confidence_score=confidence,
        email_source_url=parsed.email_source_url,
        search_query_used=query,
    )
