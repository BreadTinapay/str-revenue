from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analytics, auth, campaigns, discovery, enrichment, leads, unsubscribe

app = FastAPI(title="STR Revenue Platform", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(discovery.router, prefix="/discovery", tags=["discovery"])
app.include_router(enrichment.router, prefix="/enrichment", tags=["enrichment"])
app.include_router(leads.router, prefix="/leads", tags=["leads"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(campaigns.router, prefix="/campaigns", tags=["campaigns"])
app.include_router(unsubscribe.router, prefix="/unsubscribe", tags=["unsubscribe"])


@app.get("/health")
def health():
    return {"status": "ok"}
