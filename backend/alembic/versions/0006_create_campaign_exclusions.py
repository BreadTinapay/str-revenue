"""create campaign_exclusions

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-17

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "campaign_exclusions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column("excluded_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_campaign_exclusions_campaign_id", "campaign_exclusions", ["campaign_id"])
    op.create_index("ix_campaign_exclusions_lead_id", "campaign_exclusions", ["lead_id"])
    op.create_unique_constraint(
        "uq_campaign_exclusions_campaign_lead", "campaign_exclusions", ["campaign_id", "lead_id"]
    )


def downgrade() -> None:
    op.drop_table("campaign_exclusions")
