from __future__ import annotations

import hashlib
import io
from datetime import datetime, timezone

import geopandas as gpd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.store import DatasetRecord


def generate_ulpin(dataset_id: str, parcel_count: int) -> str:
    digest = hashlib.sha256(f"{dataset_id}:{parcel_count}".encode()).hexdigest().upper()
    return f"{digest[0:4]}-{digest[4:8]}-{digest[8:12]}-{digest[12:16]}"


def build_certificate_pdf(
    record: DatasetRecord,
    owner_name: str,
    village: str,
    district: str,
    state: str,
    survey_number: str | None = None,
) -> tuple[bytes, str]:
    gdf: gpd.GeoDataFrame = record.harmonized if record.harmonized is not None else record.gdf
    parcel_count = int(len(gdf))
    total_area = float(gdf.geometry.area.sum()) if parcel_count else 0.0
    ulpin = generate_ulpin(record.id, parcel_count)
    issued_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    survey = survey_number or f"SYN-{ulpin[0:4]}"
    confidence = record.harmonize_meta.get("confidence", {})
    score = confidence.get("xgboost_score") or confidence.get("rule_based_score") or 0.0

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Land Mutation Certificate {ulpin}",
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "CertTitle",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#0F3D3E"),
        spaceAfter=4,
        alignment=1,
    )
    subtitle = ParagraphStyle(
        "CertSub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#4A5A5A"),
        alignment=1,
        spaceAfter=12,
    )
    body = ParagraphStyle("CertBody", parent=styles["Normal"], fontSize=10, leading=14)

    story = [
        Paragraph("SpatialShift AI", title),
        Paragraph("Simulated Land Mutation Certificate · NGDRS / ULPIN compatible layout", subtitle),
        Spacer(1, 6),
    ]

    info = [
        ["ULPIN (simulated)", ulpin],
        ["Certificate ID", f"SSA-{record.id[:8].upper()}"],
        ["Issued at", issued_at],
        ["Owner / right holder", owner_name],
        ["Survey / plot no.", survey],
        ["Village", village],
        ["District / State", f"{district}, {state}"],
        ["Parcels harmonized", str(parcel_count)],
        ["Total area (m²)", f"{total_area:,.2f}"],
        ["Target CRS", "EPSG:32643 (UTM Zone 43N)"],
        ["Harmonization confidence", f"{float(score) * 100:.1f}%"],
        ["Verification URL", f"https://verify.spatialshift.local/ulpin/{ulpin}"],
    ]
    table = Table(info, colWidths=[70 * mm, 100 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DCEEEA")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F7F6")]),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#0F3D3E")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#B7C9C6")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.extend(
        [
            table,
            Spacer(1, 14),
            Paragraph(
                "This simulated certificate attests that cadastral geometries were ingested, "
                "reprojected to UTM EPSG:32643, topologically planarized (sliver removal, "
                "overlap resolution, and node snap to building wall vectors), and scored with "
                "a hybrid rule-based / XGBoost confidence model. It is intended for SpatialShift "
                "demo workflows and is not a legally registered mutation.",
                body,
            ),
            Spacer(1, 10),
            Paragraph(
                f"Digital signature (simulated): SHA-256({ulpin}:{record.id[:12]})",
                body,
            ),
        ]
    )
    doc.build(story)
    return buffer.getvalue(), ulpin
