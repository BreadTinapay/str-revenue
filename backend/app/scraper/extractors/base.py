from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class DiscoveredListing:
    listing_id: str
    host_display_name: str
    property_type: str | None
    nightly_price: float | None
    currency: str
    city: str
    state: str
    neighborhood: str | None
    amenities_summary: str | None
    source_url: str


class ListingExtractor(ABC):
    """Interface for a market-discovery source.

    Airbnb's DOM changes regularly, so extractors are isolated and swappable —
    each source (or Airbnb layout version) gets its own extractor implementing
    this interface rather than one shared brittle script.
    """

    @abstractmethod
    def discover(self, city: str, state: str, max_pages: int) -> list[DiscoveredListing]:
        raise NotImplementedError
