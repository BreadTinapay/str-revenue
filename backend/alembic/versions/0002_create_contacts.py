"""create contacts

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-17

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "market_listing_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("market_listings.id"),
            nullable=False,
        ),
        sa.Column("candidate_name", sa.String(), nullable=False),
        sa.Column("website_url", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("social_links", postgresql.JSONB(), nullable=True),
        sa.Column("confidence_score", sa.String(), nullable=False),
        sa.Column("email_source_url", sa.String(), nullable=True),
        sa.Column("search_query_used", sa.String(), nullable=True),
        sa.Column("enriched_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_contacts_market_listing_id", "contacts", ["market_listing_id"])


def downgrade() -> None:
    op.drop_table("contacts")
