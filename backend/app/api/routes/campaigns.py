import json
import logging
import uuid

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_admin
from app.campaigns.jobs import send_campaign
from app.campaigns.suppression import suppress
from app.db import get_db
from app.models import Campaign, CampaignSend, EmailEvent, User
from app.queue import campaign_queue
from app.schemas import CampaignCreateRequest, CampaignOut, CampaignSendOut

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=CampaignOut, dependencies=[Depends(require_admin)])
def create_campaign(
    request: CampaignCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    campaign = Campaign(
        id=uuid.uuid4(),
        name=request.name,
        subject_template=request.subject_template,
        body_html_template=request.body_html_template,
        target_filter=request.target_filter,
        created_by=user.id,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("", response_model=list[CampaignOut], dependencies=[Depends(get_current_user)])
def list_campaigns(db: Session = Depends(get_db)):
    return db.query(Campaign).order_by(Campaign.created_at.desc()).all()


@router.get("/{campaign_id}", response_model=CampaignOut, dependencies=[Depends(get_current_user)])
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.get("/{campaign_id}/sends", response_model=list[CampaignSendOut], dependencies=[Depends(get_current_user)])
def list_campaign_sends(campaign_id: str, db: Session = Depends(get_db)):
    return db.query(CampaignSend).filter(CampaignSend.campaign_id == campaign_id).all()


@router.post("/{campaign_id}/send", dependencies=[Depends(require_admin)])
def trigger_campaign_send(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == "sending":
        raise HTTPException(status_code=409, detail="Campaign is already sending")

    job = campaign_queue.enqueue(send_campaign, campaign_id=campaign_id, job_timeout="2h")
    return {"job_id": job.id, "status": "queued"}


@router.get("/jobs/{job_id}", dependencies=[Depends(get_current_user)])
def get_job_status(job_id: str):
    job = campaign_queue.fetch_job(job_id)
    if job is None:
        return {"status": "not_found"}
    return {"status": job.get_status(), "result": job.result}


@router.post("/webhooks/ses")
async def ses_webhook(request: Request, db: Session = Depends(get_db)):
    """Receives SNS notifications for SES bounce/complaint/delivery events.

    No auth — SNS can't authenticate as our app. This is a common, accepted
    tradeoff for inbound webhooks; the payload is validated by shape rather
    than by credential.
    """
    body = json.loads(await request.body())
    message_type = body.get("Type")

    if message_type == "SubscriptionConfirmation":
        # Auto-confirm the SNS subscription so bounce/complaint events start flowing.
        requests.get(body["SubscribeURL"], timeout=10)
        return {"status": "subscription_confirmed"}

    if message_type != "Notification":
        return {"status": "ignored"}

    message = json.loads(body["Message"])
    event_type = message.get("eventType", "").lower()
    tags = message.get("mail", {}).get("tags", {})
    campaign_send_ids = tags.get("campaign_send_id", [])

    if not campaign_send_ids:
        logger.warning("SES webhook event with no campaign_send_id tag: %s", event_type)
        return {"status": "no_matching_send"}

    send = db.query(CampaignSend).filter(CampaignSend.id == campaign_send_ids[0]).first()
    if send is None:
        return {"status": "send_not_found"}

    db.add(EmailEvent(id=uuid.uuid4(), campaign_send_id=send.id, event_type=event_type, raw_payload=message))

    if event_type == "bounce" and message.get("bounce", {}).get("bounceType") == "Permanent":
        suppress(db, send.email, reason="hard_bounce", source=str(send.id))
    elif event_type == "complaint":
        suppress(db, send.email, reason="complaint", source=str(send.id))

    db.commit()
    return {"status": "recorded"}
