import logging
import time
import uuid
from datetime import datetime

from app.campaigns.compose import assert_compliant, compose_email
from app.campaigns.providers.base import EmailSendError
from app.campaigns.providers.factory import get_email_provider
from app.campaigns.suppression import is_suppressed
from app.config import settings
from app.db import SessionLocal
from app.models import Campaign, CampaignSend, Lead

logger = logging.getLogger(__name__)

DELAY_BETWEEN_SENDS_SECONDS = 1.0  # conservative default; SES sandbox allows ~1/sec


def send_campaign(campaign_id: str) -> dict:
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign is None:
            raise ValueError(f"Campaign {campaign_id} not found")

        campaign.status = "sending"
        db.commit()

        sent, suppressed, failed = 0, 0, 0

        try:
            # Compliance is a global setting, not per-recipient — check it once,
            # before creating any campaign_send rows, so a misconfiguration fails
            # the whole run cleanly instead of getting discovered lead-by-lead.
            assert_compliant()

            query = db.query(Lead).filter(Lead.best_email.isnot(None))
            target_filter = campaign.target_filter or {}
            if target_filter.get("city"):
                query = query.filter(Lead.city.ilike(target_filter["city"]))
            if target_filter.get("state"):
                query = query.filter(Lead.state.ilike(target_filter["state"]))
            if target_filter.get("confidence"):
                query = query.filter(Lead.best_confidence_score == target_filter["confidence"])

            leads = query.all()
            provider = get_email_provider()

            for lead in leads:
                unsubscribe_token = uuid.uuid4().hex
                send_row = CampaignSend(
                    id=uuid.uuid4(),
                    campaign_id=campaign.id,
                    lead_id=lead.id,
                    email=lead.best_email,
                    unsubscribe_token=unsubscribe_token,
                )

                if is_suppressed(db, lead.best_email):
                    send_row.status = "suppressed"
                    db.add(send_row)
                    db.commit()
                    suppressed += 1
                    continue

                unsubscribe_url = f"{settings.app_base_url}/unsubscribe/{unsubscribe_token}"
                context = {"name": lead.canonical_name, "city": lead.city, "state": lead.state}
                subject, html_body = compose_email(
                    subject_template=campaign.subject_template,
                    body_html_template=campaign.body_html_template,
                    context=context,
                    unsubscribe_url=unsubscribe_url,
                )

                try:
                    result = provider.send(
                        to=lead.best_email,
                        from_address=settings.email_from_address,
                        from_name=settings.email_from_name,
                        subject=subject,
                        html_body=html_body,
                        reply_to=settings.email_reply_to,
                        tags={"campaign_send_id": str(send_row.id)},
                    )
                    send_row.status = "sent"
                    send_row.provider = provider.name
                    send_row.provider_message_id = result.provider_message_id
                    send_row.sent_at = datetime.utcnow()
                    sent += 1
                except EmailSendError as e:
                    send_row.status = "failed"
                    send_row.error_message = str(e)
                    failed += 1
                    logger.exception("Send failed for %s", lead.best_email)

                db.add(send_row)
                db.commit()
                time.sleep(DELAY_BETWEEN_SENDS_SECONDS)

            campaign.status = "completed"
            db.commit()
        except Exception:
            campaign.status = "failed"
            db.commit()
            raise

        logger.info(
            "Campaign %s: %d sent, %d suppressed, %d failed", campaign_id, sent, suppressed, failed
        )
        return {"sent": sent, "suppressed": suppressed, "failed": failed}
    finally:
        db.close()
