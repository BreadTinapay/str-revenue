from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_admin
from app.db import get_db
from app.enrichment.jobs import run_enrichment
from app.models import Contact
from app.queue import enrichment_queue
from app.schemas import ContactOut, EnrichmentRunRequest

router = APIRouter()


@router.post("/run", dependencies=[Depends(require_admin)])
def trigger_enrichment_run(request: EnrichmentRunRequest):
    job = enrichment_queue.enqueue(
        run_enrichment,
        city=request.city,
        state=request.state,
        job_timeout="60m",
    )
    return {"job_id": job.id, "status": "queued"}


@router.get("/jobs/{job_id}", dependencies=[Depends(get_current_user)])
def get_job_status(job_id: str):
    job = enrichment_queue.fetch_job(job_id)
    if job is None:
        return {"status": "not_found"}
    return {"status": job.get_status(), "result": job.result}


@router.get("/contacts", response_model=list[ContactOut], dependencies=[Depends(get_current_user)])
def list_contacts(
    confidence: str | None = Query(default=None, description="high | low | none"),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(Contact)
    if confidence:
        query = query.filter(Contact.confidence_score == confidence)
    return query.order_by(Contact.enriched_at.desc()).limit(limit).all()
