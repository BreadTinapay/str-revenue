from app.campaigns.providers.base import EmailProvider
from app.campaigns.providers.resend import ResendProvider
from app.campaigns.providers.ses import SESProvider
from app.config import settings

_PROVIDERS = {
    "ses": SESProvider,
    "resend": ResendProvider,
}


def get_email_provider() -> EmailProvider:
    provider_cls = _PROVIDERS.get(settings.email_provider)
    if provider_cls is None:
        raise ValueError(f"Unknown email provider '{settings.email_provider}'")
    return provider_cls()
