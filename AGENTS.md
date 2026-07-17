# AGENTS.md

## Quick Start

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
docker compose up --build
```

## Architecture

| Service  | Port    | Stack                                    |
|----------|---------|------------------------------------------|
| frontend | 5173    | React 18, Vite, TailwindCSS, TypeScript  |
| api      | 8000    | FastAPI, SQLAlchemy, Alembic, Python 3.12 |
| worker   | internal| RQ worker, same Python codebase          |
| postgres | 5432    | Postgres 16                              |
| redis    | 6379    | Redis 7                                  |
| searxng  | 8080    | Web search for enrichment                |

## Key Commands

```powershell
# Full stack (background)
docker compose up -d --build

# View logs
docker compose logs -f

# Stop and wipe DB
docker compose down -v

# Create/reset admin
docker compose exec api python seed_admin.py admin@example.com yourpassword
```

## Backend Structure

- `backend/app/main.py` — FastAPI app entrypoint
- `backend/app/models.py` — SQLAlchemy models (MarketListing, Contact, Lead, Campaign, etc.)
- `backend/app/config.py` — Pydantic Settings, loads from `backend/.env`
- `backend/app/api/routes/` — API endpoints (auth, discovery, enrichment, leads, campaigns, etc.)
- `backend/worker.py` — RQ worker consuming 4 queues: discovery, enrichment, dedup, campaign
- `backend/alembic/` — DB migrations

## Frontend Structure

- `frontend/src/App.tsx` — React Router routes, auth guards
- `frontend/src/lib/api.ts` — API client functions
- `frontend/src/lib/auth.tsx` — AuthContext, RequireAuth, RequireAdmin
- `frontend/src/pages/` — Page components (11 pages)

## Data Pipeline

Discovery → Enrichment → Dedup → Campaigns

1. **Discovery**: Scrapes Airbnb listings via SearXNG, stores in `market_listings`
2. **Enrichment**: Searches web for host contact info, stores in `contacts`
3. **Dedup**: Merges listings/contacts into unified `leads` (fuzzy name match within city/state)
4. **Campaigns**: Sends emails via SES or Resend, tracks in `campaign_sends`

## Important Notes

- **All writes go through RQ workers** — API routes enqueue jobs, workers process them
- **Suppression list is checked before every send** — unsubscribes, bounces, complaints
- **JWT auth** — token stored in localStorage, sent as Bearer header
- **Admin-only routes**: discovery, enrichment, campaigns, users, settings, activity log
- **Frontend uses Vite polling** for HMR in Docker (`usePolling: true` in vite.config.ts)

## Environment Variables

Backend (`backend/.env`):
- `JWT_SECRET_KEY` — change before production
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — optional first-user bootstrap
- `EMAIL_PROVIDER` — `ses` or `resend` (required for campaigns)

Frontend (`frontend/.env`):
- `VITE_API_URL` — default `http://localhost:8000`

## Local Dev (without Docker)

Requires: Python 3.12, Node 20, Postgres 16, Redis 7, SearXNG
Run `alembic upgrade head` and `python seed_admin.py ...` before use.
