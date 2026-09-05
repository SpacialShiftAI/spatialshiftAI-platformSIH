from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import __version__
from app.config import CORS_ORIGINS
from app.exceptions import (
    SpatialShiftError,
    http_exception_handler,
    spatial_shift_exception_handler,
    success_payload,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.routers.export_pdf import router as export_router
from app.routers.harmonize import router as harmonize_router
from app.routers.upload import router as upload_router

app = FastAPI(
    title="SpatialShift AI",
    description=(
        "Cadastral ingest, topological planarization, confidence scoring, "
        "and simulated ULPIN mutation certificates."
    ),
    version=__version__,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-ULPIN", "X-Dataset-Id"],
)

app.add_exception_handler(SpatialShiftError, spatial_shift_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(upload_router)
app.include_router(harmonize_router)
app.include_router(export_router)


@app.get("/api/health")
async def health():
    return success_payload(
        {
            "service": "spatialshift-ai",
            "version": __version__,
            "crs": "EPSG:32643",
        }
    )
