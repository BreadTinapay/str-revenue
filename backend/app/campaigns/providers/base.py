from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SendResult:
    provider_message_id: str


class EmailSendError(Exception):
    pass


class EmailProvider(ABC):
    """Swappable email-sending backend. Every provider (SES, Resend, ...) must
    implement this same interface so the campaign engine never hard-codes a
    specific vendor's API.
    """

    name: str

    @abstractmethod
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
        raise NotImplementedError
