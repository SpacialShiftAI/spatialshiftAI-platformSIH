from fastapi import APIRouter, File, UploadFile

from app.exceptions import SpatialShiftError, success_payload
from app.services.ingest import dataset_summary, ingest_uploads

router = APIRouter(prefix="/api", tags=["ingest"])


@router.post("/upload")
async def upload_spatial_files(files: list[UploadFile] = File(...)):
    if not files:
        raise SpatialShiftError("Attach one or more spatial files.", code="NO_FILES")
    record = await ingest_uploads(files)
    return success_payload(dataset_summary(record), message="Geometries normalized to EPSG:32643.")
