import logging
import time
import uuid
from datetime import datetime

from app.campaigns.compose import assert_compliant, compose_email
from app.campaigns.providers.base import EmailSendError
from app.campaigns.providers.factory import get_email_provider
from app.campaigns.targeting import excluded_lead_ids, matching_leads_query, suppressed_emails_lower
from app.config import settings
from app.db import SessionLocal
from app.models import Campaign, CampaignSend
from app.settings_store import get_effective_settings

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

        sent, suppressed, excluded_count, failed = 0, 0, 0, 0

        try:
            effective = get_effective_settings(db)

            # Compliance is a global setting, not per-recipient — check it once,
            # before creating any campaign_send rows, so a misconfiguration fails
            # the whole run cleanly instead of getting discovered lead-by-lead.
            assert_compliant(effective.company_physical_address)

            leads = matching_leads_query(db, campaign.target_filter).all()
            excluded_ids = excluded_lead_ids(db, campaign.id)
            suppressed_set = suppressed_emails_lower(db, [lead.best_email for lead in leads])
            provider = get_email_provider()

            send_rows = []
            for lead in leads:
                unsubscribe_token = uuid.uuid4().hex
                send_row = CampaignSend(
                    id=uuid.uuid4(),
                    campaign_id=campaign.id,
                    lead_id=lead.id,
                    email=lead.best_email,
                    unsubscribe_token=unsubscribe_token,
                )

                if lead.id in excluded_ids:
                    send_row.status = "excluded"
                    send_rows.append(send_row)
                    excluded_count += 1
                    continue

                if lead.best_email.lower() in suppressed_set:
                    send_row.status = "suppressed"
                    send_rows.append(send_row)
                    suppressed += 1
                    continue

                unsubscribe_url = f"{settings.app_base_url}/unsubscribe/{unsubscribe_token}"
                context = {"name": lead.canonical_name, "city": lead.city, "state": lead.state}
                subject, html_body = compose_email(
                    subject_template=campaign.subject_template,
                    body_html_template=campaign.body_html_template,
                    context=context,
                    unsubscribe_url=unsubscribe_url,
                    company_physical_address=effective.company_physical_address,
                )

                try:
                    result = provider.send(
                        to=lead.best_email,
                        from_address=effective.email_from_address,
                        from_name=effective.email_from_name,
                        subject=subject,
                        html_body=html_body,
                        reply_to=effective.email_reply_to,
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

                send_rows.append(send_row)
                time.sleep(DELAY_BETWEEN_SENDS_SECONDS)

            db.bulk_save_objects(send_rows)
            db.commit()

            campaign.status = "completed"
            db.commit()
        except Exception:
            campaign.status = "failed"
            db.commit()
            raise

        logger.info(
            "Campaign %s: %d sent, %d suppressed, %d excluded, %d failed",
            campaign_id,
            sent,
            suppressed,
            excluded_count,
            failed,
        )
        return {"sent": sent, "suppressed": suppressed, "excluded": excluded_count, "failed": failed}
    finally:
        db.close()
