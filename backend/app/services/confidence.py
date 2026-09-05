from __future__ import annotations

from typing import Any

import numpy as np

try:
    import xgboost as xgb

    _HAS_XGB = True
except ImportError:  # pragma: no cover
    xgb = None
    _HAS_XGB = False

FEATURE_ORDER = (
    "invalid_ratio",
    "sliver_ratio",
    "overlap_fixed",
    "snap_ratio",
    "mean_snap_distance_m",
    "mean_compactness",
    "validity",
)


def _clip(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def rule_based_score(features: dict[str, float]) -> dict[str, float]:
    geometry_validity = _clip(features.get("validity", 0.0) * (1.0 - features.get("invalid_ratio", 0.0)))
    sliver_cleanliness = _clip(1.0 - features.get("sliver_ratio", 0.0) * 2.0)
    overlap_resolution = 0.92 if features.get("overlap_fixed", 0.0) >= 1.0 else 0.78
    snap_quality = _clip(1.0 - features.get("mean_snap_distance_m", 0.0) / 2.0)
    compactness = _clip(features.get("mean_compactness", 0.0) / 0.8)

    weighted = (
        0.28 * geometry_validity
        + 0.22 * sliver_cleanliness
        + 0.18 * overlap_resolution
        + 0.20 * snap_quality
        + 0.12 * compactness
    )
    return {
        "geometry_validity": round(geometry_validity, 4),
        "sliver_cleanliness": round(sliver_cleanliness, 4),
        "overlap_resolution": round(overlap_resolution, 4),
        "node_snap_quality": round(snap_quality, 4),
        "compactness": round(compactness, 4),
        "rule_based_score": round(_clip(weighted), 4),
    }


def _synthetic_training_set(n: int = 400) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(43)
    x = np.zeros((n, len(FEATURE_ORDER)), dtype=np.float32)
    y = np.zeros(n, dtype=np.float32)
    for i in range(n):
        invalid_ratio = float(rng.uniform(0, 0.4))
        sliver_ratio = float(rng.uniform(0, 0.5))
        overlap_fixed = float(rng.integers(0, 2))
        snap_ratio = float(rng.uniform(0, 1))
        mean_snap = float(rng.uniform(0, 2.5))
        compactness = float(rng.uniform(0.2, 0.95))
        validity = 1.0 if invalid_ratio < 0.15 else 0.0
        row = [invalid_ratio, sliver_ratio, overlap_fixed, snap_ratio, mean_snap, compactness, validity]
        x[i] = row
        score = (
            0.28 * validity * (1 - invalid_ratio)
            + 0.22 * (1 - sliver_ratio * 2)
            + 0.18 * (0.92 if overlap_fixed else 0.7)
            + 0.20 * max(0, 1 - mean_snap / 2)
            + 0.12 * (compactness / 0.8)
            + rng.normal(0, 0.03)
        )
        y[i] = _clip(score)
    return x, y


class ConfidenceModel:
    def __init__(self) -> None:
        self.booster = None
        if _HAS_XGB:
            features, labels = _synthetic_training_set()
            dtrain = xgb.DMatrix(features, label=labels, feature_names=list(FEATURE_ORDER))
            self.booster = xgb.train(
                {
                    "objective": "reg:squarederror",
                    "max_depth": 4,
                    "eta": 0.12,
                    "subsample": 0.9,
                    "colsample_bytree": 0.9,
                    "eval_metric": "rmse",
                    "seed": 43,
                },
                dtrain,
                num_boost_round=80,
            )

    def predict_xgb(self, features: dict[str, float]) -> float | None:
        if self.booster is None:
            return None
        vector = np.array([[features.get(name, 0.0) for name in FEATURE_ORDER]], dtype=np.float32)
        dmatrix = xgb.DMatrix(vector, feature_names=list(FEATURE_ORDER))
        pred = float(self.booster.predict(dmatrix)[0])
        return round(_clip(pred), 4)


_model = ConfidenceModel()


def score_harmonization(features: dict[str, float]) -> dict[str, Any]:
    breakdown = rule_based_score(features)
    xgb_score = _model.predict_xgb(features)
    breakdown["xgboost_score"] = xgb_score
    breakdown["model"] = "hybrid" if xgb_score is not None else "rule_based"
    return breakdown
