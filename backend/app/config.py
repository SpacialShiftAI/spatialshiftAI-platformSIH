from __future__ import annotations

TARGET_CRS = "EPSG:32643"
DEFAULT_ASSUMED_CRS = "EPSG:4326"

# UTM Zone 43N — typical for western/central India cadastral workflows
SLIVER_AREA_M2 = 2.0
SNAP_TOLERANCE_M = 0.75
OVERLAP_AREA_M2 = 0.5

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]
