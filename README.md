# STR Revenue Platform

Market intelligence and lead enrichment platform for short-term rental outreach. The stack is a React dashboard, FastAPI API, background worker, Postgres, Redis, and SearXNG.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with the engine running
- Free local ports: `5173`, `8000`, `8080`, `5432`, `6379`

## Quick start

1. Copy environment files if you do not already have them:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   Copy-Item frontend\.env.example frontend\.env
   ```

2. Start everything:

   ```powershell
   docker compose up --build
   ```

3. Open the app:

   - Dashboard: http://localhost:5173
   - API health: http://localhost:8000/health

On first startup, the API container waits for Postgres, runs database migrations, and optionally creates the first admin user from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`.

Default login (from `.env.example`):

- Email: `admin@example.com`
- Password: `changeme`

Change those values in `backend/.env` before running in any shared environment.

## Services

| Service  | URL / port              | Purpose                          |
|----------|-------------------------|----------------------------------|
| frontend | http://localhost:5173   | React dashboard                  |
| api      | http://localhost:8000   | FastAPI backend                  |
| searxng  | http://localhost:8080   | Web search for lead enrichment   |
| postgres | localhost:5432          | Database                         |
| redis    | localhost:6379          | Background job queue             |
| worker   | internal                | Discovery, enrichment, campaigns |

## Useful commands

```powershell
# Run in the background
docker compose up -d --build

# View logs
docker compose logs -f

# Create or reset an admin manually
docker compose exec api python seed_admin.py admin@example.com yourpassword

# Stop services
docker compose down

# Stop and wipe the database volume
docker compose down -v
```

## Configuration

Backend settings live in `backend/.env`. Important values:

- `JWT_SECRET_KEY` — set a strong secret before production
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — optional first-user bootstrap
- `EMAIL_PROVIDER`, `AWS_*`, or `RESEND_API_KEY` — required only for sending campaigns

Frontend settings live in `frontend/.env`:

- `VITE_API_URL` — API base URL (default `http://localhost:8000`)

## Local development without Docker

Docker Compose is the supported path. Running services manually requires Python 3.12, Node 20, Postgres 16, Redis 7, and SearXNG installed locally, plus `alembic upgrade head` and `python seed_admin.py ...` before use.
