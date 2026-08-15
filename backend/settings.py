from __future__ import annotations

import os


def cors_origins() -> list[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def stitch_status() -> str:
    api_key = os.getenv("STITCH_API_KEY", "").strip()
    mcp_url = os.getenv("STITCH_MCP_URL", "").strip()
    if api_key and mcp_url:
        return "configured"
    return "missing"
