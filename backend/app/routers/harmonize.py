from fastapi import APIRouter

from app.exceptions import SpatialShiftError, success_payload
from app.schemas import HarmonizeRequest
from app.services.confidence import score_harmonization
from app.services.planarize import planarize_dataset
from app.store import store

router = APIRouter(prefix="/api", tags=["harmonize"])


@router.post("/harmonize")
async def harmonize_dataset(body: HarmonizeRequest):
    record = store.require(body.dataset_id)
    buildings = None
    if body.building_dataset_id:
        buildings = store.require(body.building_dataset_id).gdf

    try:
        result = planarize_dataset(
            cadastral=record.gdf,
            buildings=buildings,
            sliver_area_m2=body.sliver_area_m2,
            snap_tolerance_m=body.snap_tolerance_m,
        )
    except ValueError as exc:
        raise SpatialShiftError(str(exc), code="HARMONIZE_FAILED") from exc

    confidence = score_harmonization(result.features)
    record.harmonized = result.gdf
    record.harmonize_meta = {
        "removed_slivers": result.removed_slivers,
        "overlap_fixes": result.overlap_fixes,
        "snapped_nodes": result.snapped_nodes,
        "simulated_wall_segments": result.simulated_wall_segments,
        "mean_snap_distance_m": result.mean_snap_distance_m,
        "confidence": confidence,
    }

    geojson = result.gdf.to_crs("EPSG:4326").__geo_interface__
    return success_payload(
        {
            "dataset_id": record.id,
            "feature_count": int(len(result.gdf)),
            "removed_slivers": result.removed_slivers,
            "overlap_fixes": result.overlap_fixes,
            "snapped_nodes": result.snapped_nodes,
            "simulated_wall_segments": result.simulated_wall_segments,
            "mean_snap_distance_m": result.mean_snap_distance_m,
            "confidence": confidence,
            "geojson": geojson,
        },
        message="Topological planarization complete.",
    )
