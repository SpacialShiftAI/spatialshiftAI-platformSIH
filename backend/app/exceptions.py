from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class SpatialShiftError(Exception):
    def __init__(self, message: str, code: str = "SPATIAL_ERROR", status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def error_payload(message: str, code: str, details: Any | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "ok": False,
        "error": {"code": code, "message": message},
    }
    if details is not None:
        body["error"]["details"] = details
    return body


def success_payload(data: Any, message: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"ok": True, "data": data}
    if message:
        body["message"] = message
    return body


async def spatial_shift_exception_handler(_: Request, exc: SpatialShiftError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(exc.message, exc.code),
    )


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(str(exc.detail), "HTTP_ERROR"),
    )


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_payload("Request validation failed", "VALIDATION_ERROR", details=str(exc.errors())),
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=error_payload("An unexpected server error occurred", "INTERNAL_ERROR"),
    )
