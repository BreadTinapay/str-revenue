import random
import time

from app.config import settings


def jittered_delay() -> None:
    """Sleep a random interval between requests to behave like a light, occasional visitor."""
    delay = random.uniform(settings.scraper_min_delay_seconds, settings.scraper_max_delay_seconds)
    time.sleep(delay)
