import logging
import re

import requests

from app.config import settings
from app.scraper.extractors.base import DiscoveredListing, ListingExtractor
from app.scraper.rate_limit import jittered_delay

logger = logging.getLogger(__name__)

SEARXNG_ENDPOINT = f"{settings.searxng_url.rstrip('/')}/search"

AIRBNB_ROOM_RE = re.compile(r"airbnb\.com/rooms/(\d+)")
PRICE_RE = re.compile(r"\$\s*([\d,]+)")


class SearxngDiscoveryExtractor(ListingExtractor):
    """Discovers Airbnb listings via SearXNG web search instead of scraping
    airbnb.com directly. This avoids Airbnb's bot detection on datacenter IPs.
    """

    def __init__(self, known_listing_ids: set[str] | None = None):
        self.known_listing_ids = known_listing_ids or set()

    def discover(self, city: str, state: str, max_pages: int = 3) -> list[DiscoveredListing]:
        results: list[DiscoveredListing] = []
        seen_ids: set[str] = set()

        queries = [
            f"site:airbnb.com/rooms/ {city} {state}",
            f"airbnb {city} {state} listing",
            f"site:airbnb.com {city} {state} vacation rental",
        ]

        for page_num in range(max_pages):
            query = queries[page_num % len(queries)]
            if page_num > 0:
                query += f" page {page_num + 1}"

            jittered_delay()

            try:
                search_results = _search_searxng(query, num=20)
            except Exception:
                logger.exception("SearXNG search failed for query: %s", query)
                continue

            if not search_results:
                logger.info("No results from SearXNG for query: %s", query)
                continue

            for item in search_results:
                listing_id = _extract_listing_id(item.get("url", ""))
                if not listing_id or listing_id in seen_ids or listing_id in self.known_listing_ids:
                    continue
                seen_ids.add(listing_id)

                title = item.get("title", "")
                content = item.get("content", "")
                url = item.get("url", "")

                host_name, property_type = _parse_title(title)
                price = _parse_price(content) or _parse_price(title)

                source_url = f"https://www.airbnb.com/rooms/{listing_id}"

                results.append(DiscoveredListing(
                    listing_id=listing_id,
                    host_display_name=host_name or title or "Unknown",
                    property_type=property_type,
                    nightly_price=price,
                    currency="USD",
                    city=city,
                    state=state,
                    neighborhood=None,
                    amenities_summary=None,
                    source_url=source_url,
                ))

            logger.info(
                "Page %d: found %d new listings so far (query: %s)",
                page_num + 1, len(results), query,
            )

        logger.info("Discovery for %s, %s found %d total new listings", city, state, len(results))
        return results


def _search_searxng(query: str, num: int = 20) -> list[dict]:
    resp = requests.get(
        SEARXNG_ENDPOINT,
        params={"q": query, "format": "json", "categories": "general"},
        timeout=15,
    )
    if resp.status_code == 429:
        logger.warning("SearXNG rate-limited (429)")
        return []
    resp.raise_for_status()
    return resp.json().get("results", [])[:num]


def _extract_listing_id(url: str) -> str | None:
    match = AIRBNB_ROOM_RE.search(url)
    return match.group(1) if match else None


def _parse_title(title: str) -> tuple[str | None, str | None]:
    """Try to extract host name and property type from a search result title.
    Airbnb titles are often like: "Cozy Cabin in Asheville | Hosted by John" or
    "Entire cabin · 2 bedrooms · Asheville, NC".
    """
    host_name = None
    property_type = None

    hosted_match = re.search(r"Hosted by\s+([^|·\n]+)", title, re.IGNORECASE)
    if hosted_match:
        host_name = hosted_match.group(1).strip()

    for ptype in ("cabin", "house", "apartment", "condo", "villa", "cottage",
                   "loft", "townhouse", "bungalow", "chalet", "guesthouse",
                   "room", "studio", "suite", "farm stay", "treehouse",
                   "boat", "camper", "yurt", "tent", "castle"):
        if ptype in title.lower():
            property_type = ptype.title()
            break

    return host_name, property_type


def _parse_price(text: str) -> float | None:
    match = PRICE_RE.search(text)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except ValueError:
        return None
