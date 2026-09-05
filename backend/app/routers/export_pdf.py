from fastapi import APIRouter
from fastapi.responses import Response

from app.exceptions import SpatialShiftError
from app.schemas import ExportPdfRequest
from app.services.certificate import build_certificate_pdf
from app.store import store

router = APIRouter(prefix="/api", tags=["export"])


@router.post("/export-pdf")
async def export_mutation_certificate(body: ExportPdfRequest):
    record = store.require(body.dataset_id)
    if record.harmonized is None:
        raise SpatialShiftError(
            "Harmonize the dataset before generating a mutation certificate.",
            code="NOT_HARMONIZED",
            status_code=409,
        )

    pdf_bytes, ulpin = build_certificate_pdf(
        record=record,
        owner_name=body.owner_name,
        village=body.village,
        district=body.district,
        state=body.state,
        survey_number=body.survey_number,
    )
    filename = f"spatialshift-mutation-{ulpin}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-ULPIN": ulpin,
            "X-Dataset-Id": record.id,
        },
    )
