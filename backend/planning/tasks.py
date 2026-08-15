from __future__ import annotations

from celery import shared_task

from planning.services import execute_solver_run


@shared_task(
    autoretry_for=(ConnectionError,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
    soft_time_limit=110,
    time_limit=120,
)
def run_solver_task(run_id: str) -> None:
    execute_solver_run(run_id)
