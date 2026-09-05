from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

import geopandas as gpd

DatasetKind = Literal["cadastral", "buildings", "generic"]


class DatasetRecord:
    def __init__(
        self,
        gdf: gpd.GeoDataFrame,
        source_format: str,
        filename: str,
        kind: DatasetKind = "generic",
    ) -> None:
        self.id = str(uuid4())
        self.gdf = gdf
        self.source_format = source_format
        self.filename = filename
        self.kind = kind
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.harmonized: gpd.GeoDataFrame | None = None
        self.harmonize_meta: dict[str, Any] = {}


class DatasetStore:
    def __init__(self) -> None:
        self._items: dict[str, DatasetRecord] = {}

    def put(self, record: DatasetRecord) -> DatasetRecord:
        self._items[record.id] = record
        return record

    def get(self, dataset_id: str) -> DatasetRecord | None:
        return self._items.get(dataset_id)

    def require(self, dataset_id: str) -> DatasetRecord:
        from app.exceptions import SpatialShiftError

        record = self._items.get(dataset_id)
        if record is None:
            raise SpatialShiftError(
                f"Dataset '{dataset_id}' was not found. Upload data first.",
                code="DATASET_NOT_FOUND",
                status_code=404,
            )
        return record


store = DatasetStore()
