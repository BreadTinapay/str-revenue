import boto3
from botocore.exceptions import ClientError

from app.campaigns.providers.base import EmailProvider, EmailSendError, SendResult
from app.config import settings


class SESProvider(EmailProvider):
    name = "ses"

    def __init__(self):
        self._client = boto3.client(
            "sesv2",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )

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
        try:
            kwargs = {
                "FromEmailAddress": f"{from_name} <{from_address}>",
                "Destination": {"ToAddresses": [to]},
                "Content": {
                    "Simple": {
                        "Subject": {"Data": subject, "Charset": "UTF-8"},
                        "Body": {"Html": {"Data": html_body, "Charset": "UTF-8"}},
                    }
                },
            }
            if reply_to:
                kwargs["ReplyToAddresses"] = [reply_to]
            if tags:
                # Used to correlate bounce/complaint SNS notifications back to
                # the campaign_send row that triggered the send.
                kwargs["EmailTags"] = [{"Name": k, "Value": v} for k, v in tags.items()]

            resp = self._client.send_email(**kwargs)
            return SendResult(provider_message_id=resp["MessageId"])
        except ClientError as e:
            raise EmailSendError(str(e)) from e
