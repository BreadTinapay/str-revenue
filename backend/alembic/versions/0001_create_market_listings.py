"""create market_listings

Revision ID: 0001
Revises:
Create Date: 2026-07-17

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("listing_id", sa.String(), nullable=False),
        sa.Column("host_display_name", sa.String(), nullable=False),
        sa.Column("property_type", sa.String(), nullable=True),
        sa.Column("nightly_price", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(), server_default="USD"),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("neighborhood", sa.String(), nullable=True),
        sa.Column("amenities_summary", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column("scraped_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_market_listings_listing_id", "market_listings", ["listing_id"])
    op.create_index("ix_market_listings_host_display_name", "market_listings", ["host_display_name"])
    op.create_index("ix_market_listings_city", "market_listings", ["city"])
    op.create_index("ix_market_listings_state", "market_listings", ["state"])


def downgrade() -> None:
    op.drop_table("market_listings")
