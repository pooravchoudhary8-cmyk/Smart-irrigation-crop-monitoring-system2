"""
Module 2: Zone-Based Intelligence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Virtual moisture mapping using AI spatial interpolation.
1 sensor covers a large area by estimating moisture for
neighbouring zones using crop type, soil type, and distance.

USP: "Reduces hardware cost using AI-based virtual sensing"
"""
import math
import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter
from models import (
    ZoneConfig, ZoneConfigureRequest, ZoneEstimateRequest,
    SensorReading, ZoneMoisture, ZoneMapResponse,
)

router = APIRouter(prefix="/zones", tags=["Zone Intelligence"])

# ── In-memory stores ──────────────────────────────────────────
ZONES: dict[str, dict] = {}
LATEST_MAP: list[ZoneMoisture] = []
PERSISTENCE_FILE = Path(__file__).parent.parent / "data" / "zones_config.json"


def _load_zones():
    global ZONES
    if PERSISTENCE_FILE.exists():
        with open(PERSISTENCE_FILE, "r") as f:
            ZONES = json.load(f)


def _save_zones():
    PERSISTENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PERSISTENCE_FILE, "w") as f:
        json.dump(ZONES, f, indent=2)


_load_zones()


# ── Crop & Soil moisture factors ──────────────────────────────
# How much moisture a crop type retains relative to baseline
CROP_MOISTURE_FACTOR = {
    "Wheat": 1.0,
    "Rice": 1.25,       # Paddy needs more water
    "Maize": 0.95,
    "Sugarcane": 1.2,
    "Cotton": 0.85,
    "Soybean": 0.9,
    "Potato": 1.1,
    "Tomato": 1.05,
    "Vegetables": 1.1,
}

# How well soil retains moisture (higher = retains more)
SOIL_RETENTION_FACTOR = {
    "Clay": 1.3,
    "Loamy": 1.0,
    "Sandy": 0.7,
    "Black Soil": 1.2,
    "Red Soil": 0.85,
    "Alluvial": 1.1,
    "Laterite": 0.8,
}


def _optimal_moisture(crop_type: str) -> tuple[float, float]:
    """Returns (min_optimal, max_optimal) moisture % for a crop"""
    ranges = {
        "Wheat":      (35, 60),
        "Rice":       (60, 90),
        "Maize":      (40, 65),
        "Sugarcane":  (50, 75),
        "Cotton":     (30, 55),
        "Soybean":    (40, 60),
        "Potato":     (45, 70),
        "Tomato":     (40, 65),
        "Vegetables": (40, 65),
    }
    return ranges.get(crop_type, (35, 65))


def _moisture_status(moisture: float, crop_type: str) -> str:
    lo, hi = _optimal_moisture(crop_type)
    if moisture < lo * 0.6:
        return "critical"
    elif moisture < lo:
        return "low"
    elif moisture <= hi:
        return "optimal"
    else:
        return "wet"


def _distance(z1: dict, z2: dict) -> float:
    """Euclidean distance between two zones"""
    dx = z1.get("position_x", 0) - z2.get("position_x", 0)
    dy = z1.get("position_y", 0) - z2.get("position_y", 0)
    return math.sqrt(dx * dx + dy * dy) or 1.0  # avoid zero


# ── Spatial Interpolation (IDW) ───────────────────────────────

def _idw_interpolate(target_zone: dict, sensor_readings: dict[str, float], all_zones: dict, power: float = 2.0) -> tuple[float, float]:
    """
    Inverse Distance Weighting interpolation.
    Estimates moisture at target zone using distance-weighted average
    of known sensor readings, adjusted for crop/soil type.

    Returns (estimated_moisture, confidence)
    """
    if not sensor_readings:
        return 50.0, 0.1  # No data — pure guess

    weights = []
    values = []

    for sid, moisture in sensor_readings.items():
        # Find which zone this sensor belongs to
        sensor_zone = None
        for z in all_zones.values():
            if z.get("sensor_id") == sid:
                sensor_zone = z
                break
        if sensor_zone is None:
            continue

        dist = _distance(target_zone, sensor_zone)
        weight = 1.0 / (dist ** power)
        weights.append(weight)

        # Adjust for soil type difference
        source_soil_factor = SOIL_RETENTION_FACTOR.get(sensor_zone.get("soil_type", "Loamy"), 1.0)
        target_soil_factor = SOIL_RETENTION_FACTOR.get(target_zone.get("soil_type", "Loamy"), 1.0)
        soil_adjustment = target_soil_factor / source_soil_factor

        # Adjust for crop type difference
        source_crop_factor = CROP_MOISTURE_FACTOR.get(sensor_zone.get("crop_type", "Wheat"), 1.0)
        target_crop_factor = CROP_MOISTURE_FACTOR.get(target_zone.get("crop_type", "Wheat"), 1.0)
        crop_adjustment = target_crop_factor / source_crop_factor

        adjusted_moisture = moisture * soil_adjustment * crop_adjustment
        values.append(adjusted_moisture)

    if not weights:
        return 50.0, 0.1

    total_weight = sum(weights)
    estimated = sum(w * v for w, v in zip(weights, values)) / total_weight

    # Confidence: based on distance (closer sensors = higher confidence)
    max_weight = max(weights)
    confidence = min(0.95, max_weight / total_weight * 0.8 + 0.15)

    return max(0, min(100, round(estimated, 1))), round(confidence, 2)


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/configure")
async def configure_zones(req: ZoneConfigureRequest):
    """
    Define zones in the field.
    Each zone can optionally have a sensor assigned.
    """
    for z in req.zones:
        ZONES[z.zone_id] = z.model_dump()
    _save_zones()

    sensored = sum(1 for z in ZONES.values() if z.get("sensor_id"))
    return {
        "success": True,
        "total_zones": len(ZONES),
        "zones_with_sensors": sensored,
        "zones_interpolated": len(ZONES) - sensored,
        "message": f"{len(req.zones)} zone(s) configured. {len(ZONES) - sensored} zone(s) will use AI estimation."
    }


@router.post("/estimate", response_model=ZoneMapResponse)
async def estimate_zones(req: ZoneEstimateRequest):
    """
    Given sensor readings, estimate moisture for ALL zones.
    Zones with sensors get direct values.
    Zones without sensors get AI-interpolated values.
    """
    global LATEST_MAP

    # Build sensor_id → moisture mapping
    sensor_values: dict[str, float] = {}
    for r in req.readings:
        sensor_values[r.sensor_id] = r.moisture_percent

    zone_results: list[ZoneMoisture] = []
    sensors_used = 0

    for zid, zone in ZONES.items():
        sid = zone.get("sensor_id")
        crop = zone.get("crop_type", "Wheat")

        if sid and sid in sensor_values:
            # Direct sensor reading
            moisture = sensor_values[sid]
            lo, _ = _optimal_moisture(crop)
            zone_results.append(ZoneMoisture(
                zone_id=zid,
                name=zone.get("name", zid),
                estimated_moisture=round(moisture, 1),
                confidence=0.95,
                source="sensor",
                crop_type=crop,
                needs_irrigation=moisture < lo,
                status=_moisture_status(moisture, crop),
            ))
            sensors_used += 1
        else:
            # AI interpolation
            est, conf = _idw_interpolate(zone, sensor_values, ZONES)
            lo, _ = _optimal_moisture(crop)
            zone_results.append(ZoneMoisture(
                zone_id=zid,
                name=zone.get("name", zid),
                estimated_moisture=est,
                confidence=conf,
                source="interpolated",
                crop_type=crop,
                needs_irrigation=est < lo,
                status=_moisture_status(est, crop),
            ))

    # Coverage score: % of zones that have direct sensor
    total = len(ZONES) or 1
    coverage = round((sensors_used / total) * 100, 1)

    LATEST_MAP = zone_results

    return ZoneMapResponse(
        zones=zone_results,
        coverage_score=coverage,
        timestamp=datetime.now().isoformat(),
    )


@router.get("/map", response_model=ZoneMapResponse)
async def get_zone_map():
    """Get the latest virtual moisture map"""
    return ZoneMapResponse(
        zones=LATEST_MAP,
        coverage_score=round(
            sum(1 for z in LATEST_MAP if z.source == "sensor") / max(len(LATEST_MAP), 1) * 100, 1
        ),
        timestamp=datetime.now().isoformat(),
    )


@router.get("/config")
async def get_zones_config():
    """Get all configured zones"""
    return {
        "count": len(ZONES),
        "zones": list(ZONES.values()),
    }


@router.delete("/config/{zone_id}")
async def delete_zone(zone_id: str):
    if zone_id in ZONES:
        del ZONES[zone_id]
        _save_zones()
        return {"success": True}
    return {"success": False, "error": "Zone not found"}
