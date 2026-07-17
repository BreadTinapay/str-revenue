import redis
from rq import Queue

from app.config import settings

redis_conn = redis.from_url(settings.redis_url)
discovery_queue = Queue("discovery", connection=redis_conn)
enrichment_queue = Queue("enrichment", connection=redis_conn)
dedup_queue = Queue("dedup", connection=redis_conn)
campaign_queue = Queue("campaign", connection=redis_conn)
