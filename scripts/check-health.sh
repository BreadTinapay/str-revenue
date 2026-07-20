#!/bin/bash
set -e

HOST="${1:?Usage: ./check-health.sh HOST}"

echo "Checking health at $HOST..."

# Check API health
echo -n "API health: "
curl -sf "$HOST/health" | python -m json.tool 2>/dev/null || echo "FAILED"

# Check if frontend loads
echo -n "Frontend: "
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$HOST/")
if [ "$STATUS" = "200" ]; then
  echo "OK ($STATUS)"
else
  echo "FAILED ($STATUS)"
fi
