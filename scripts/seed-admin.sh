#!/bin/bash
set -e

# Seed or reset admin user
# Usage: ./seed-admin.sh EMAIL PASSWORD

EMAIL="${1:?Usage: ./seed-admin.sh EMAIL PASSWORD}"
PASSWORD="${2:?Usage: ./seed-admin.sh EMAIL PASSWORD}"

docker compose exec api python seed_admin.py "$EMAIL" "$PASSWORD"
