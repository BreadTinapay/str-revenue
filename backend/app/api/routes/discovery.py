from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_admin
from app.db import get_db
from app.models import MarketListing
from app.queue import discovery_queue
from app.schemas import DiscoveryRunRequest, MarketListingOut
from app.scraper.jobs import run_discovery

router = APIRouter()


@router.post("/run", dependencies=[Depends(require_admin)])
def trigger_discovery_run(request: DiscoveryRunRequest):
    job = discovery_queue.enqueue(
        run_discovery,
        city=request.city,
        state=request.state,
        max_pages=request.max_pages,
        job_timeout="30m",
    )
    return {"job_id": job.id, "status": "queued"}


@router.get("/jobs/{job_id}", dependencies=[Depends(get_current_user)])
def get_job_status(job_id: str):
    job = discovery_queue.fetch_job(job_id)
    if job is None:
        return {"status": "not_found"}
    return {"status": job.get_status(), "result": job.result}


@router.get("/listings", response_model=list[MarketListingOut], dependencies=[Depends(get_current_user)])
def list_listings(
    city: str | None = Query(default=None),
    state: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(MarketListing)
    if city:
        query = query.filter(MarketListing.city.ilike(city))
    if state:
        query = query.filter(MarketListing.state.ilike(state))
    return query.order_by(MarketListing.scraped_at.desc()).limit(limit).all()
