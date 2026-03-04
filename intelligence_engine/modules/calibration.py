"""
Module 1: Sensor Calibration System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Self-calibrating intelligence for any low-cost sensor.
Farmer does a 2-step calibration (dry reading + wet reading),
and the system converts all future raw readings to accurate moisture %.

USP: "Eliminates the need for expensive industrial probes"
"""
import json
import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter
from models import (
    CalibrationRequest, CalibrationProfile,
    ConvertRequest, ConvertResponse,
)

router = APIRouter(prefix="/calibration", tags=["Sensor Calibration"])

# ── In-memory store (+ JSON persistence for demo) ──────────
PROFILES: dict[str, dict] = {}
PERSISTENCE_FILE = Path(__file__).parent.parent / "data" / "calibration_profiles.json"


def _load_profiles():
    global PROFILES
    if PERSISTENCE_FILE.exists():
        with open(PERSISTENCE_FILE, "r") as f:
            PROFILES = json.load(f)


def _save_profiles():
    PERSISTENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PERSISTENCE_FILE, "w") as f:
        json.dump(PROFILES, f, indent=2)


# Load on module import
_load_profiles()


def _moisture_quality(pct: float) -> str:
    """Human-friendly moisture category"""
    if pct < 15:
        return "dry"
    elif pct < 35:
        return "low"
    elif pct < 65:
        return "optimal"
    elif pct < 85:
        return "wet"
    else:
        return "saturated"


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/calibrate", response_model=CalibrationProfile)
async def calibrate_sensor(req: CalibrationRequest):
    """
    Step 1: Farmer inserts sensor in DRY soil → records dry_value
    Step 2: Farmer inserts sensor in WET soil → records wet_value
    System stores calibration profile.
    """
    # Detect if sensor is inverted (some read HIGH when dry)
    is_inverted = req.dry_value > req.wet_value

    profile = {
        "sensor_id": req.sensor_id,
        "dry_value": req.dry_value,
        "wet_value": req.wet_value,
        "sensor_type": req.sensor_type,
        "label": req.label or req.sensor_id,
        "calibrated_at": datetime.now().isoformat(),
        "is_inverted": is_inverted,
    }

    PROFILES[req.sensor_id] = profile
    _save_profiles()

    return CalibrationProfile(**profile)


@router.post("/convert", response_model=ConvertResponse)
async def convert_reading(req: ConvertRequest):
    """
    Convert a raw ADC reading → calibrated moisture %
    using the stored calibration profile.
    """
    if req.sensor_id not in PROFILES:
        # Fallback: use default ESP32 ADC conversion (0-4095 range)
        moisture = max(0, min(100, ((4095 - req.raw_value) / 4095) * 100))
        return ConvertResponse(
            sensor_id=req.sensor_id,
            raw_value=req.raw_value,
            moisture_percent=round(moisture, 1),
            quality=_moisture_quality(moisture),
            calibrated=False,
            error="No calibration profile found — using default ADC conversion"
        )

    p = PROFILES[req.sensor_id]
    dry = p["dry_value"]
    wet = p["wet_value"]

    if p["is_inverted"]:
        # Inverted sensor: dry reads HIGH, wet reads LOW
        moisture = ((dry - req.raw_value) / (dry - wet)) * 100
    else:
        # Normal sensor: dry reads LOW, wet reads HIGH
        moisture = ((req.raw_value - dry) / (wet - dry)) * 100

    moisture = max(0.0, min(100.0, moisture))

    return ConvertResponse(
        sensor_id=req.sensor_id,
        raw_value=req.raw_value,
        moisture_percent=round(moisture, 1),
        quality=_moisture_quality(moisture),
        calibrated=True,
    )


@router.get("/profiles")
async def get_profiles():
    """List all sensor calibration profiles"""
    return {
        "count": len(PROFILES),
        "profiles": list(PROFILES.values()),
        "message": f"{len(PROFILES)} sensor(s) calibrated"
    }


@router.delete("/profiles/{sensor_id}")
async def delete_profile(sensor_id: str):
    """Remove a calibration profile"""
    if sensor_id in PROFILES:
        del PROFILES[sensor_id]
        _save_profiles()
        return {"success": True, "message": f"Profile '{sensor_id}' deleted"}
    return {"success": False, "error": "Profile not found"}
