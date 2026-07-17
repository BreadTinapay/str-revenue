#!/bin/sh
set -e

echo "Waiting for database..."
python - <<'PY'
import sys
import time

from sqlalchemy import create_engine, text
from app.config import settings

deadline = time.time() + 60
last_error = None

while time.time() < deadline:
    try:
        engine = create_engine(settings.database_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001 - retry until postgres is ready
        last_error = exc
        time.sleep(2)

print(f"Database not ready after 60s: {last_error}", file=sys.stderr)
sys.exit(1)
PY

echo "Running database migrations..."
alembic upgrade head

if [ -n "$SEED_ADMIN_EMAIL" ] && [ -n "$SEED_ADMIN_PASSWORD" ]; then
  echo "Ensuring admin user exists..."
  python seed_admin.py "$SEED_ADMIN_EMAIL" "$SEED_ADMIN_PASSWORD"
fi

exec "$@"
