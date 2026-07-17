"""create leads, lead_sources, merge_log + pg_trgm

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-17

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("canonical_name", sa.String(), nullable=False),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("best_email", sa.String(), nullable=True),
        sa.Column("best_phone", sa.String(), nullable=True),
        sa.Column("best_website", sa.String(), nullable=True),
        sa.Column("best_confidence_score", sa.String(), nullable=False, server_default="none"),
        sa.Column("listing_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_leads_canonical_name", "leads", ["canonical_name"])
    op.create_index("ix_leads_city", "leads", ["city"])
    op.create_index("ix_leads_state", "leads", ["state"])
    op.execute(
        "CREATE INDEX ix_leads_canonical_name_trgm ON leads USING gin (canonical_name gin_trgm_ops)"
    )

    op.create_table(
        "lead_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column(
            "market_listing_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("market_listings.id"),
            nullable=False,
        ),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id"), nullable=True),
        sa.Column("added_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_lead_sources_lead_id", "lead_sources", ["lead_id"])
    op.create_index("ix_lead_sources_market_listing_id", "lead_sources", ["market_listing_id"])

    op.create_table(
        "merge_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=False),
        sa.Column(
            "market_listing_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("market_listings.id"),
            nullable=False,
        ),
        sa.Column("match_type", sa.String(), nullable=False),
        sa.Column("similarity_score", sa.Float(), nullable=True),
        sa.Column("merged_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_merge_log_lead_id", "merge_log", ["lead_id"])


def downgrade() -> None:
    op.drop_table("merge_log")
    op.drop_table("lead_sources")
    op.drop_table("leads")
