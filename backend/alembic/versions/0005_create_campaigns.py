"""create suppression_list, campaigns, campaign_sends, email_events

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-17

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "suppression_list",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("suppressed_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_suppression_list_email", "suppression_list", ["email"], unique=True)

    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("subject_template", sa.String(), nullable=False),
        sa.Column("body_html_template", sa.Text(), nullable=False),
        sa.Column("target_filter", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="draft"),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "campaign_sends",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column("provider_message_id", sa.String(), nullable=True),
        sa.Column("unsubscribe_token", sa.String(), nullable=False, unique=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_campaign_sends_campaign_id", "campaign_sends", ["campaign_id"])
    op.create_index("ix_campaign_sends_lead_id", "campaign_sends", ["lead_id"])
    op.create_index("ix_campaign_sends_unsubscribe_token", "campaign_sends", ["unsubscribe_token"], unique=True)

    op.create_table(
        "email_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "campaign_send_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaign_sends.id"), nullable=False
        ),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_email_events_campaign_send_id", "email_events", ["campaign_send_id"])


def downgrade() -> None:
    op.drop_table("email_events")
    op.drop_table("campaign_sends")
    op.drop_table("campaigns")
    op.drop_table("suppression_list")
