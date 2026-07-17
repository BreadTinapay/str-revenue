import logging
from dataclasses import dataclass
from urllib.parse import urlparse

import requests

from app.config import settings

logger = logging.getLogger(__name__)

SEARXNG_ENDPOINT = f"{settings.searxng_url.rstrip('/')}/search"

# Never treat these as the "business's own website": STR platforms (contact
# enrichment must never be sourced from Airbnb itself), real-estate/rental
# marketplaces and aggregators, and generic directories. A prefix match on
# these covers regional variants (airbnb.ie, airbnb.co.za, vrbo.com/de, ...).
NON_PRIMARY_DOMAIN_PREFIXES = (
    "airbnb.",
    "vrbo.",
    "booking.",
    "tripadvisor.",
    "expedia.",
    "yelp.",
    "google.",
    "bbb.org",
    "yellowpages.",
    "evolve.com",
    "cozycozy.com",
    "apartments.com",
    "trulia.com",
    "hellolanding.com",
    "homes.com",
    "peerspace.com",
    "zillow.com",
    "redfin.com",
    "realtor.com",
    "rent.com",
    "apartmentguide.com",
    "furnishedfinder.com",
    "vacasa.com",
)

# File types Google/SearXNG index that are never a business's own contact page.
NON_PRIMARY_URL_SUFFIXES = (".pdf", ".doc", ".docx", ".ppt", ".pptx")

SOCIAL_DOMAINS = {
    "facebook.com": "facebook",
    "instagram.com": "instagram",
    "linkedin.com": "linkedin",
    "twitter.com": "twitter",
    "x.com": "twitter",
}


@dataclass
class SearchResult:
    url: str
    title: str
    snippet: str


class SearchQuotaExceeded(Exception):
    """Kept for interface compatibility; SearXNG has no per-key quota, but the
    underlying engines it queries can rate-limit it under heavy load."""


def search(query: str, num: int = 5) -> list[SearchResult]:
    resp = requests.get(
        SEARXNG_ENDPOINT,
        params={"q": query, "format": "json", "categories": "general"},
        timeout=15,
    )

    if resp.status_code == 429:
        raise SearchQuotaExceeded("SearXNG's underlying engines are rate-limiting")
    resp.raise_for_status()

    items = resp.json().get("results", [])[:num]
    return [
        SearchResult(url=item["url"], title=item.get("title", ""), snippet=item.get("content", ""))
        for item in items
        if "url" in item
    ]


def domain_of(url: str) -> str:
    netloc = urlparse(url).netloc.lower()
    return netloc[4:] if netloc.startswith("www.") else netloc


def _is_non_primary(url: str) -> bool:
    domain = domain_of(url)
    if domain in SOCIAL_DOMAINS:
        return True
    if any(domain.startswith(prefix) for prefix in NON_PRIMARY_DOMAIN_PREFIXES):
        return True
    if url.lower().split("?")[0].endswith(NON_PRIMARY_URL_SUFFIXES):
        return True
    return False


def pick_primary_candidate(results: list[SearchResult]) -> SearchResult | None:
    """First result that isn't an STR platform, aggregator, directory, social
    profile, or a non-HTML document."""
    for result in results:
        if not _is_non_primary(result.url):
            return result
    return None


def extract_social_links(results: list[SearchResult]) -> dict[str, str]:
    socials: dict[str, str] = {}
    for result in results:
        domain = domain_of(result.url)
        social_name = SOCIAL_DOMAINS.get(domain)
        if social_name and social_name not in socials:
            socials[social_name] = result.url
    return socials
