from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.campaigns.suppression import suppress
from app.db import get_db
from app.models import CampaignSend

router = APIRouter()


@router.get("/{token}", response_class=HTMLResponse)
def unsubscribe(token: str, db: Session = Depends(get_db)):
    """Public, unauthenticated one-click unsubscribe. Processes immediately —
    no queueing, no confirmation step — per CAN-SPAM's prompt-honor requirement.
    """
    send = db.query(CampaignSend).filter(CampaignSend.unsubscribe_token == token).first()

    if send is None:
        return HTMLResponse("<p>This unsubscribe link is invalid or has expired.</p>", status_code=404)

    suppress(db, send.email, reason="unsubscribe", source=str(send.id))

    return HTMLResponse(
        f"""
        <html>
          <body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center;">
            <h2>You've been unsubscribed</h2>
            <p>{send.email} will not receive further emails from us.</p>
          </body>
        </html>
        """
    )
