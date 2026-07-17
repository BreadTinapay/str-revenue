import logging
import re
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_PATTERN = re.compile(r"\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}")

# Emails on a domain that don't belong to the business itself (image CDNs,
# analytics pixels, common placeholder addresses).
JUNK_EMAIL_DOMAINS = {"sentry.io", "example.com", "wixpress.com", "godaddy.com"}

# The email regex will happily match filenames like "photo@2x.webp" or OCR
# noise from PDFs ("m@S.nK"); reject anything whose "TLD" is actually an
# asset extension, plus require a plausible domain shape.
ASSET_EXTENSIONS = {
    "webp", "png", "jpg", "jpeg", "gif", "svg", "ico", "css", "js",
    "woff", "woff2", "ttf", "eot", "pdf", "mp4", "webm",
}
VALID_EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9._%+-]{2,64}@[a-zA-Z0-9-]{2,63}(\.[a-zA-Z0-9-]{2,63})+$"
)

CONTACT_PATHS = ["", "/contact", "/contact-us", "/about"]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


@dataclass
class ParsedContactInfo:
    email: str | None
    email_source_url: str | None
    phone: str | None


def fetch_and_parse(base_url: str) -> ParsedContactInfo:
    """Fetch the business's homepage and a couple of likely contact pages,
    extracting the first plausible email/phone found. A single, low-volume
    fetch of the business's own public site — not the STR platform.
    """
    for path in CONTACT_PATHS:
        url = base_url.rstrip("/") + path
        try:
            resp = requests.get(url, timeout=10, headers={"User-Agent": USER_AGENT})
            if resp.status_code != 200:
                continue
            if "text/html" not in resp.headers.get("Content-Type", ""):
                continue
        except requests.RequestException:
            logger.info("Failed to fetch %s during enrichment", url)
            continue

        email = _extract_email(resp.text)
        phone = _extract_phone(resp.text)

        if email or phone:
            return ParsedContactInfo(
                email=email,
                email_source_url=url if email else None,
                phone=phone,
            )

    return ParsedContactInfo(email=None, email_source_url=None, phone=None)


def _extract_email(html: str) -> str | None:
    for match in EMAIL_PATTERN.findall(html):
        if not VALID_EMAIL_PATTERN.match(match):
            continue
        tld = match.rsplit(".", 1)[-1].lower()
        if tld in ASSET_EXTENSIONS:
            continue
        domain = match.split("@")[-1].lower()
        if domain in JUNK_EMAIL_DOMAINS:
            continue
        return match
    return None


def _extract_phone(html: str) -> str | None:
    match = PHONE_PATTERN.search(html)
    return match.group(0) if match else None
