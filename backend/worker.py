from rq import Worker

from app.queue import campaign_queue, dedup_queue, discovery_queue, enrichment_queue, redis_conn

if __name__ == "__main__":
    worker = Worker(
        [discovery_queue, enrichment_queue, dedup_queue, campaign_queue], connection=redis_conn
    )
    worker.work()
