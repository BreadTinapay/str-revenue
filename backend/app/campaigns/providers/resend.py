import requests

from app.campaigns.providers.base import EmailProvider, EmailSendError, SendResult
from app.config import settings

RESEND_ENDPOINT = "https://api.resend.com/emails"


class ResendProvider(EmailProvider):
    """Dev/testing adapter — quick to set up locally, not the production path."""

    name = "resend"

    def send(
        self,
        *,
        to: str,
        from_address: str,
        from_name: str,
        subject: str,
        html_body: str,
        reply_to: str | None = None,
        tags: dict[str, str] | None = None,
    ) -> SendResult:
        if not settings.resend_api_key:
            raise EmailSendError("RESEND_API_KEY not configured")

        payload = {
            "from": f"{from_name} <{from_address}>",
            "to": [to],
            "subject": subject,
            "html": html_body,
        }
        if reply_to:
            payload["reply_to"] = reply_to
        if tags:
            payload["tags"] = [{"name": k, "value": v} for k, v in tags.items()]

        resp = requests.post(
            RESEND_ENDPOINT,
            json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=15,
        )
        if resp.status_code >= 400:
            raise EmailSendError(f"Resend error {resp.status_code}: {resp.text}")

        return SendResult(provider_message_id=resp.json()["id"])
