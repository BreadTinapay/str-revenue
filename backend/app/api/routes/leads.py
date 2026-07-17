import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_admin
from app.db import get_db
from app.dedup.jobs import run_deduplication
from app.models import Lead, LeadSource, MarketListing, MergeLog
from app.queue import dedup_queue
from app.schemas import DedupRunRequest, LeadDetailOut, LeadOut

router = APIRouter()


@router.post("/dedup/run", dependencies=[Depends(require_admin)])
def trigger_dedup_run(request: DedupRunRequest):
    job = dedup_queue.enqueue(
        run_deduplication,
        city=request.city,
        state=request.state,
        job_timeout="30m",
    )
    return {"job_id": job.id, "status": "queued"}


@router.get("/dedup/jobs/{job_id}", dependencies=[Depends(get_current_user)])
def get_job_status(job_id: str):
    job = dedup_queue.fetch_job(job_id)
    if job is None:
        return {"status": "not_found"}
    return {"status": job.get_status(), "result": job.result}


@router.get("", response_model=list[LeadOut], dependencies=[Depends(get_current_user)])
def list_leads(
    city: str | None = Query(default=None),
    state: str | None = Query(default=None),
    confidence: str | None = Query(default=None, description="high | low | none"),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(Lead)
    if city:
        query = query.filter(Lead.city.ilike(city))
    if state:
        query = query.filter(Lead.state.ilike(state))
    if confidence:
        query = query.filter(Lead.best_confidence_score == confidence)
    return query.order_by(Lead.updated_at.desc()).limit(limit).all()


@router.get("/export.csv", dependencies=[Depends(get_current_user)])
def export_leads_csv(
    city: str | None = Query(default=None),
    state: str | None = Query(default=None),
    confidence: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Lead)
    if city:
        query = query.filter(Lead.city.ilike(city))
    if state:
        query = query.filter(Lead.state.ilike(state))
    if confidence:
        query = query.filter(Lead.best_confidence_score == confidence)
    leads = query.order_by(Lead.updated_at.desc()).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["name", "city", "state", "email", "phone", "website", "confidence", "listing_count", "created_at"]
    )
    for lead in leads:
        writer.writerow(
            [
                lead.canonical_name,
                lead.city,
                lead.state,
                lead.best_email or "",
                lead.best_phone or "",
                lead.best_website or "",
                lead.best_confidence_score,
                lead.listing_count,
                lead.created_at.isoformat(),
            ]
        )
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )


@router.get("/{lead_id}", response_model=LeadDetailOut, dependencies=[Depends(get_current_user)])
def get_lead_detail(lead_id: str, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")

    merge_history = db.query(MergeLog).filter(MergeLog.lead_id == lead.id).order_by(MergeLog.merged_at).all()

    listing_ids = [row.market_listing_id for row in db.query(LeadSource).filter(LeadSource.lead_id == lead.id).all()]
    source_listings = db.query(MarketListing).filter(MarketListing.id.in_(listing_ids)).all()

    return LeadDetailOut(
        **LeadOut.model_validate(lead).model_dump(),
        merge_history=merge_history,
        source_listings=source_listings,
    )
