from fastapi import APIRouter, Depends, Query

from app.auth.deps import get_current_user
from app.geo import list_cities, list_states

router = APIRouter()


@router.get("/states", dependencies=[Depends(get_current_user)])
def get_states():
    return list_states()


@router.get("/cities", dependencies=[Depends(get_current_user)])
def get_cities(
    state: str = Query(..., min_length=2, max_length=2),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    return list_cities(state, q, limit)
