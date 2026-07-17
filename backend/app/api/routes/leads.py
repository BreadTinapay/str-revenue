import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Query as SAQuery
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_admin
from app.db import get_db
from app.dedup.jobs import run_deduplication
from app.models import Campaign, CampaignSend, Lead, LeadSource, MarketListing, MergeLog, SuppressionEntry
from app.queue import dedup_queue
from app.schemas import DedupRunRequest, LeadDetailOut, LeadOut, LeadSendHistoryEntryOut

router = APIRouter()


def _last_contacted_map(db: Session, lead_ids: list) -> dict:
    if not lead_ids:
        return {}
    rows = (
        db.query(CampaignSend.lead_id, func.max(CampaignSend.sent_at))
        .filter(CampaignSend.lead_id.in_(lead_ids), CampaignSend.status == "sent")
        .group_by(CampaignSend.lead_id)
        .all()
    )
    return {lead_id: sent_at for lead_id, sent_at in rows}


def _suppression_map(db: Session, emails: list[str]) -> dict:
    """Maps lowercase email -> reason for every email in the suppression list
    that matches one of the given addresses. Filters in SQL instead of loading
    the entire table.
    """
    lowered = {e.lower() for e in emails if e}
    if not lowered:
        return {}
    rows = (
        db.query(SuppressionEntry.email, SuppressionEntry.reason)
        .filter(func.lower(SuppressionEntry.email).in_(lowered))
        .all()
    )
    return {email.lower(): reason for email, reason in rows}


def _to_lead_out(lead: Lead, last_contacted_at, suppression: dict | None = None) -> LeadOut:
    data = LeadOut.model_validate(lead).model_dump()
    data["last_contacted_at"] = last_contacted_at
    reason = (suppression or {}).get((lead.best_email or "").lower())
    data["is_suppressed"] = reason is not None
    data["suppression_reason"] = reason
    return LeadOut(**data)


def _parse_market(market: str) -> tuple[str, str] | None:
    """Markets are passed as 'City, State' strings (matching how they're
    displayed and selected in the UI) rather than separate city/state lists —
    that avoids an ambiguous cross-product when multiple markets are selected
    at once (city=[A,B] & state=[X,Y] would also match A+Y, which may not exist).
    """
    parts = [p.strip() for p in market.split(",")]
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return None
    return parts[0], parts[1]


def _apply_market_filter(query: SAQuery, markets: list[str] | None) -> SAQuery:
    if not markets:
        return query
    conditions = []
    for market in markets:
        parsed = _parse_market(market)
        if parsed:
            city, state = parsed
            conditions.append(and_(Lead.city.ilike(city), Lead.state.ilike(state)))
    if conditions:
        query = query.filter(or_(*conditions))
    return query


def _apply_lead_filters(query: SAQuery, markets: list[str] | None, confidence: list[str] | None) -> SAQuery:
    query = _apply_market_filter(query, markets)
    if confidence:
        query = query.filter(Lead.best_confidence_score.in_(confidence))
    return query


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


@router.get("/markets", dependencies=[Depends(get_current_user)])
def list_markets(db: Session = Depends(get_db)):
    rows = db.query(Lead.city, Lead.state).distinct().order_by(Lead.city, Lead.state).all()
    return [{"city": city, "state": state, "label": f"{city}, {state}"} for city, state in rows]


@router.get("", response_model=list[LeadOut], dependencies=[Depends(get_current_user)])
def list_leads(
    market: list[str] | None = Query(default=None, description="'City, State' pairs, repeatable"),
    confidence: list[str] | None = Query(default=None, description="high | low | none, repeatable"),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    query = _apply_lead_filters(db.query(Lead), market, confidence)
    leads = query.order_by(Lead.updated_at.desc()).limit(limit).all()

    last_contacted = _last_contacted_map(db, [lead.id for lead in leads])
    suppression = _suppression_map(db, [lead.best_email for lead in leads])
    return [_to_lead_out(lead, last_contacted.get(lead.id), suppression) for lead in leads]


@router.get("/export.csv", dependencies=[Depends(get_current_user)])
def export_leads_csv(
    market: list[str] | None = Query(default=None),
    confidence: list[str] | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = _apply_lead_filters(db.query(Lead), market, confidence)
    leads = query.order_by(Lead.updated_at.desc()).all()

    last_contacted = _last_contacted_map(db, [lead.id for lead in leads])
    suppression = _suppression_map(db, [lead.best_email for lead in leads])

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "name",
            "city",
            "state",
            "email",
            "phone",
            "website",
            "confidence",
            "listing_count",
            "last_contacted_at",
            "suppressed",
            "suppression_reason",
            "created_at",
        ]
    )
    for lead in leads:
        contacted_at = last_contacted.get(lead.id)
        reason = suppression.get((lead.best_email or "").lower())
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
                contacted_at.isoformat() if contacted_at else "",
                "yes" if reason else "no",
                reason or "",
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

    last_contacted = _last_contacted_map(db, [lead.id])
    suppression = _suppression_map(db, [lead.best_email])

    return LeadDetailOut(
        **_to_lead_out(lead, last_contacted.get(lead.id), suppression).model_dump(),
        merge_history=merge_history,
        source_listings=source_listings,
    )


@router.get(
    "/{lead_id}/sends", response_model=list[LeadSendHistoryEntryOut], dependencies=[Depends(get_current_user)]
)
def get_lead_send_history(lead_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(CampaignSend, Campaign)
        .join(Campaign, Campaign.id == CampaignSend.campaign_id)
        .filter(CampaignSend.lead_id == lead_id)
        .order_by(CampaignSend.created_at.desc())
        .all()
    )
    return [
        LeadSendHistoryEntryOut(
            id=send.id,
            campaign_id=campaign.id,
            campaign_name=campaign.name,
            subject=campaign.subject_template,
            status=send.status,
            error_message=send.error_message,
            sent_at=send.sent_at,
            created_at=send.created_at,
        )
        for send, campaign in rows
    ]
