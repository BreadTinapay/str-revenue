import logging
import re

from playwright.sync_api import Page, sync_playwright

from app.config import settings
from app.scraper.extractors.base import DiscoveredListing, ListingExtractor
from app.scraper.rate_limit import jittered_delay

logger = logging.getLogger(__name__)

SEARCH_URL = "https://www.airbnb.com/s/{city}--{state}/homes?currency=USD"
ROOM_URL = "https://www.airbnb.com/rooms/{listing_id}"

# NOTE: Airbnb's DOM/data-testid attributes change periodically. These selectors
# are a starting point verified against public search-results markup at time of
# writing and WILL need updates. Keep extraction logic isolated here so a layout
# change only requires editing this file, not the job/queue/API layers.
CARD_SELECTOR = '[data-testid="card-container"]'
TITLE_SELECTOR = '[data-testid="listing-card-title"]'
NAME_SELECTOR = '[data-testid="listing-card-name"]'
PRICE_SELECTOR = '[data-testid="price-availability-row"]'
HOSTED_BY_PATTERN = re.compile(r"Hosted by ([^<]{1,80})")


class AirbnbSearchExtractor(ListingExtractor):
    """Reads Airbnb's public, logged-out search results page (and, for new
    listing_ids only, the individual listing page to read the "Hosted by"
    name — search cards show only the listing title, not the host name).

    No authentication, no co-host access, no session reuse. Only publicly
    visible name/price/property-type/amenities-summary data is captured —
    no guest data, no exact addresses, no contact info.
    """

    def __init__(self, known_listing_ids: set[str] | None = None):
        # listing_ids already in the DB — skip the extra detail-page fetch for these.
        self.known_listing_ids = known_listing_ids or set()

    def discover(self, city: str, state: str, max_pages: int) -> list[DiscoveredListing]:
        results: list[DiscoveredListing] = []

        with sync_playwright() as p:
            launch_kwargs = {"headless": True, "args": ["--no-sandbox", "--disable-setuid-sandbox"]}
            if settings.scraper_proxy_url:
                launch_kwargs["proxy"] = {"server": settings.scraper_proxy_url}

            browser = p.chromium.launch(**launch_kwargs)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                locale="en-US",
            )
            page = context.new_page()

            try:
                for page_num in range(max_pages):
                    url = SEARCH_URL.format(city=city.replace(" ", "-"), state=state)
                    if page_num > 0:
                        url += f"&items_offset={page_num * 20}"

                    jittered_delay()
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)

                    # Listing cards render client-side after hydration, well after
                    # domcontentloaded — checking for a block *before* waiting for
                    # them here would flag nearly every normal page load as blocked
                    # (confirmed: this was a real bug, not city-specific flakiness).
                    # Only treat it as inconclusive/blocked once the cards genuinely
                    # never show up within a generous timeout.
                    try:
                        page.wait_for_selector(CARD_SELECTOR, timeout=15000)
                    except Exception:
                        if _looks_blocked(page):
                            logger.warning(
                                "Possible block detected for %s, %s (page %d) — stopping run early",
                                city,
                                state,
                                page_num,
                            )
                        else:
                            logger.info(
                                "No listing cards appeared on page %d (market may have no results) — stopping pagination",
                                page_num,
                            )
                        break

                    _load_all_cards(page)
                    page_results = _extract_page(page, city, state, url)
                    if not page_results:
                        break

                    results.extend(page_results)

                for listing in results:
                    if listing.listing_id in self.known_listing_ids:
                        continue
                    jittered_delay()
                    host_name = _fetch_host_name(context, listing.listing_id)
                    if host_name:
                        listing.host_display_name = host_name
            finally:
                context.close()
                browser.close()

        return results


def _looks_blocked(page: Page) -> bool:
    """Best-effort guess at *why* no cards appeared. Only called after the
    card selector has already timed out, so this doesn't gate extraction —
    it only affects the log message. Deliberately avoids a bare "captcha"
    substring match: Airbnb ships a "disable_google_recaptcha" config flag
    on every single page load, which made that check fire constantly on
    completely normal pages.
    """
    content = page.content().lower()
    return "are you a human" in content or "access denied" in content or "verify you're human" in content


def _load_all_cards(page: Page) -> None:
    """Airbnb lazy-renders cards as the grid scrolls into view."""
    previous_count = -1
    for _ in range(8):
        current = page.query_selector_all(CARD_SELECTOR)
        if len(current) == previous_count:
            break
        previous_count = len(current)
        page.mouse.wheel(0, 2000)
        page.wait_for_timeout(600)


def _extract_page(page: Page, city: str, state: str, source_url: str) -> list[DiscoveredListing]:
    listings: list[DiscoveredListing] = []
    cards = page.query_selector_all(CARD_SELECTOR)

    for card in cards:
        try:
            listing = _extract_card(card, city, state, source_url)
            if listing:
                listings.append(listing)
        except Exception:
            logger.exception("Failed to extract a listing card; skipping")

    return listings


def _extract_card(card, city: str, state: str, source_url: str) -> DiscoveredListing | None:
    link_el = card.query_selector("a[href*='/rooms/']")
    if not link_el:
        return None
    href = link_el.get_attribute("href") or ""
    match = re.search(r"/rooms/(\d+)", href)
    if not match:
        return None
    listing_id = match.group(1)

    title_el = card.query_selector(TITLE_SELECTOR)
    property_type = title_el.inner_text().strip() if title_el else None

    name_el = card.query_selector(NAME_SELECTOR)
    listing_title = name_el.inner_text().strip() if name_el else "Unknown"

    price_el = card.query_selector(PRICE_SELECTOR)
    nightly_price = _parse_price(price_el.inner_text()) if price_el else None

    return DiscoveredListing(
        listing_id=listing_id,
        # Placeholder until the detail-page fetch resolves the real "Hosted by"
        # name for new listings; known listings keep whichever name we already have.
        host_display_name=listing_title,
        property_type=property_type,
        nightly_price=nightly_price,
        currency="USD",
        city=city,
        state=state,
        neighborhood=None,
        amenities_summary=None,
        source_url=f"https://www.airbnb.com{href}" if href.startswith("/") else href,
    )


def _fetch_host_name(context, listing_id: str) -> str | None:
    detail_page = context.new_page()
    try:
        detail_page.goto(ROOM_URL.format(listing_id=listing_id), wait_until="domcontentloaded", timeout=30000)
        detail_page.wait_for_timeout(2000)
        content = detail_page.content()
        match = HOSTED_BY_PATTERN.search(content)
        return match.group(1).strip() if match else None
    except Exception:
        logger.exception("Failed to fetch host name for listing %s", listing_id)
        return None
    finally:
        detail_page.close()


def _parse_price(text: str) -> float | None:
    match = re.search(r"[\d,]+(?:\.\d+)?", text)
    if not match:
        return None
    return float(match.group(0).replace(",", ""))
