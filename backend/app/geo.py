import json
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).parent / "geo_data" / "us_states_cities.json"

PAGE_SIZE = 50


@lru_cache(maxsize=1)
def _load() -> dict:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def list_states() -> list[dict]:
    data = _load()
    return sorted(
        ({"code": code, "name": entry["name"]} for code, entry in data.items()),
        key=lambda s: s["name"],
    )


def list_cities(
    state_code: str,
    query: str | None = None,
    limit: int = PAGE_SIZE,
    offset: int = 0,
) -> dict:
    """Return a page of city names plus total count for pagination."""
    data = _load()
    entry = data.get(state_code.upper())
    if entry is None:
        return {"cities": [], "total": 0}
    cities = entry["cities"]
    if query:
        query_lower = query.lower()
        cities = [c for c in cities if query_lower in c.lower()]
    total = len(cities)
    return {"cities": cities[offset : offset + limit], "total": total}
