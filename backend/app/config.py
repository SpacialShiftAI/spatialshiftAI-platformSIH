from __future__ import annotations

import os

TARGET_CRS = "EPSG:32643"
DEFAULT_ASSUMED_CRS = "EPSG:4326"

# UTM Zone 43N — typical for western/central India cadastral workflows
SLIVER_AREA_M2 = 2.0
SNAP_TOLERANCE_M = 0.75
OVERLAP_AREA_M2 = 0.5

_DEV_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]


def _cors_origins() -> list[str]:
    origins = list(_DEV_CORS_ORIGINS)
    extra = os.getenv("CORS_ORIGINS", "")
    for part in extra.split(","):
        origin = part.strip().rstrip("/")
        if origin and origin not in origins:
            origins.append(origin)
    return origins


CORS_ORIGINS = _cors_origins()
