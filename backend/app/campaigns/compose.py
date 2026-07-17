import re

from app.config import settings

PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*(\w+)\s*\}\}")

PLACEHOLDER_ADDRESS_MARKER = "[ADDRESS NOT YET SET]"


class ComplianceError(Exception):
    """Raised when a campaign cannot be sent without violating CAN-SPAM."""


def render_template(template: str, context: dict[str, str]) -> str:
    """Replace {{key}} placeholders. Unknown placeholders render as empty
    string rather than leaking raw template syntax to a recipient.
    """

    def _replace(match: re.Match) -> str:
        return context.get(match.group(1), "")

    return PLACEHOLDER_PATTERN.sub(_replace, template)


def build_footer(unsubscribe_url: str) -> str:
    return f"""
    <hr style="margin-top:32px;border:none;border-top:1px solid #ddd;">
    <p style="font-size:12px;color:#666;margin-top:12px;">
      {settings.company_physical_address}<br>
      You are receiving this email because your business appeared in our public market research.
      <a href="{unsubscribe_url}">Unsubscribe</a> at any time.
    </p>
    """


def assert_compliant() -> None:
    """Global, campaign-independent compliance check. Call this once before
    starting a send run — it's the same result for every recipient, so there's
    no reason to discover it lead-by-lead mid-loop.
    """
    if PLACEHOLDER_ADDRESS_MARKER in settings.company_physical_address:
        raise ComplianceError(
            "COMPANY_PHYSICAL_ADDRESS is not configured — every campaign email must include "
            "a real physical mailing address. Refusing to send until this is set."
        )


def compose_email(
    *,
    subject_template: str,
    body_html_template: str,
    context: dict[str, str],
    unsubscribe_url: str,
) -> tuple[str, str]:
    """Render a campaign's subject/body for one recipient and append the
    mandatory CAN-SPAM footer.
    """
    subject = render_template(subject_template, context)
    body = render_template(body_html_template, context)
    body_with_footer = body + build_footer(unsubscribe_url)

    return subject, body_with_footer
