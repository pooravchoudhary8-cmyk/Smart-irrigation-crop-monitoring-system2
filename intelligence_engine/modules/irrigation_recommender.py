"""
Module 3: Irrigation Recommendation Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Predicts WHEN and HOW MUCH to irrigate.
Tells the farmer: "Next irrigation after 2 days — no need today"
instead of just "moisture = 34%".

Controls sprinkler runtime based on:
  - Current moisture deficit
  - Evapotranspiration (ET) rate
  - Crop water requirements
  - Weather conditions

USP: "Intelligence layer, not just automation"
"""
import math
from datetime import datetime, timedelta

from fastapi import APIRouter
from models import (
    IrrigationRecommendRequest, IrrigationRecommendation,
    ScheduleEntry, ScheduleResponse,
)

router = APIRouter(prefix="/irrigation", tags=["Irrigation Recommender"])

# ── In-memory schedule state ──────────────────────────────────
SCHEDULES: dict[str, dict] = {}


# ── Crop water requirement tables ─────────────────────────────
# Daily water need in mm/day by crop and growth stage
CROP_WATER_NEED = {
    "Wheat":      {"seedling": 2.5, "vegetative": 4.5, "flowering": 5.5, "maturity": 3.0},
    "Rice":       {"seedling": 5.0, "vegetative": 7.0, "flowering": 8.0, "maturity": 5.0},
    "Maize":      {"seedling": 3.0, "vegetative": 5.0, "flowering": 6.5, "maturity": 3.5},
    "Sugarcane":  {"seedling": 4.0, "vegetative": 6.0, "flowering": 7.0, "maturity": 4.5},
    "Cotton":     {"seedling": 2.0, "vegetative": 4.0, "flowering": 5.0, "maturity": 2.5},
    "Soybean":    {"seedling": 2.5, "vegetative": 4.0, "flowering": 5.5, "maturity": 3.0},
    "Potato":     {"seedling": 3.0, "vegetative": 5.0, "flowering": 6.0, "maturity": 3.5},
    "Tomato":     {"seedling": 2.5, "vegetative": 4.5, "flowering": 6.0, "maturity": 3.0},
    "Vegetables": {"seedling": 2.5, "vegetative": 4.0, "flowering": 5.0, "maturity": 3.0},
}

# Optimal moisture ranges
CROP_OPTIMAL = {
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

# Soil available water capacity (mm water per mm depth)
SOIL_AWC = {
    "Clay":       0.18,
    "Loamy":      0.15,
    "Sandy":      0.08,
    "Black Soil": 0.17,
    "Red Soil":   0.10,
    "Alluvial":   0.14,
    "Laterite":   0.09,
}


def _estimate_et(temperature: float, humidity: float, wind_speed: float) -> float:
    """
    Simplified Hargreaves-based ET estimation (mm/day).
    Real projects use Penman-Monteith, but this is good for a hackathon.
    """
    # Base ET from temperature
    if temperature <= 0:
        return 1.0

    # Hargreaves simplified: ET = 0.0023 * (Tmean + 17.8) * sqrt(Trange) * Ra
    # We use a simplified version
    t_factor = 0.0023 * (temperature + 17.8) * math.sqrt(max(1, temperature * 0.4))

    # Solar radiation approximation (assume ~15 MJ/m²/day for India)
    ra = 15.0

    et_base = t_factor * ra

    # Humidity adjustment: lower humidity → higher ET
    humidity_factor = 1.0 + (50 - humidity) * 0.005

    # Wind adjustment: higher wind → higher ET
    wind_factor = 1.0 + wind_speed * 0.02

    et = et_base * humidity_factor * wind_factor

    return max(1.0, min(12.0, round(et, 2)))


def _daily_moisture_loss(et_mm: float, soil_type: str, root_depth_mm: float = 300) -> float:
    """
    Convert ET (mm/day) to soil moisture % loss per day.
    """
    awc = SOIL_AWC.get(soil_type, 0.15)
    total_available = awc * root_depth_mm  # mm of water in root zone
    if total_available <= 0:
        return 5.0
    loss_percent = (et_mm / total_available) * 100
    return round(loss_percent, 2)


def _water_needed(current_moisture: float, target_moisture: float,
                  field_area_sqm: float, soil_type: str, root_depth_mm: float = 300) -> float:
    """
    Calculate liters of water needed to bring moisture from current to target.
    """
    if current_moisture >= target_moisture:
        return 0.0

    deficit_pct = target_moisture - current_moisture
    awc = SOIL_AWC.get(soil_type, 0.15)
    total_available_mm = awc * root_depth_mm

    # mm of water needed
    water_mm = (deficit_pct / 100) * total_available_mm

    # Convert mm to liters: 1mm over 1m² = 1 liter
    liters = water_mm * field_area_sqm

    return round(max(0, liters), 1)


def _urgency(current: float, optimal_low: float) -> str:
    if current < optimal_low * 0.5:
        return "critical"
    elif current < optimal_low * 0.7:
        return "high"
    elif current < optimal_low:
        return "medium"
    elif current < optimal_low * 1.1:
        return "low"
    else:
        return "none"


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/recommend", response_model=IrrigationRecommendation)
async def recommend_irrigation(req: IrrigationRecommendRequest):
    """
    Given current conditions → returns actionable recommendation:
    - Should irrigate now?
    - How much water needed?
    - Sprinkler runtime?
    - When is next irrigation needed?
    """
    crop = req.crop_type
    soil = req.soil_type
    stage = req.crop_stage

    opt_low, opt_high = CROP_OPTIMAL.get(crop, (35, 65))
    target_moisture = (opt_low + opt_high) / 2  # Aim for midpoint

    # Calculate ET and daily moisture loss
    et = _estimate_et(req.temperature, req.humidity, req.wind_speed)
    daily_loss = _daily_moisture_loss(et, soil)

    # Crop water need (mm/day)
    crop_water = CROP_WATER_NEED.get(crop, {}).get(stage, 4.0)

    # Should irrigate?
    should_irrigate = req.current_moisture < opt_low
    urg = _urgency(req.current_moisture, opt_low)

    # Water calculation
    water_liters = _water_needed(req.current_moisture, target_moisture,
                                  req.field_area_sqm, soil)

    # Sprinkler runtime
    if req.sprinkler_flow_rate > 0 and water_liters > 0:
        runtime_min = water_liters / req.sprinkler_flow_rate
    else:
        runtime_min = 0.0

    # Predict next irrigation date
    if req.current_moisture > opt_low and daily_loss > 0:
        days_until = (req.current_moisture - opt_low) / daily_loss
    elif should_irrigate:
        days_until = 0  # Needs it NOW
    else:
        days_until = max(1, (req.current_moisture - opt_low) / max(daily_loss, 0.5))

    hours_until = round(days_until * 24, 1)

    # Build reasoning
    reasoning = []
    reasoning.append(f"Current moisture: {req.current_moisture}% (optimal: {opt_low}-{opt_high}%)")
    reasoning.append(f"Evapotranspiration rate: {et} mm/day")
    reasoning.append(f"Daily moisture loss: {daily_loss}%/day")
    reasoning.append(f"Crop ({crop}) at {stage} stage needs ~{crop_water} mm/day")

    if should_irrigate:
        reasoning.append(f"⚠️ Moisture below optimal threshold ({opt_low}%)")
    if req.temperature > 35:
        reasoning.append(f"🌡️ High temperature ({req.temperature}°C) increases water stress")
    if req.wind_speed > 15:
        reasoning.append(f"💨 High wind ({req.wind_speed} km/h) — sprinkler efficiency drops, increase runtime")
        runtime_min *= 1.2  # 20% more runtime to compensate wind loss
    if req.humidity < 30:
        reasoning.append(f"🏜️ Low humidity ({req.humidity}%) — rapid evaporation expected")

    # Human message
    if should_irrigate:
        if urg == "critical":
            message = f"🚨 CRITICAL: Irrigate NOW! Soil is dangerously dry at {req.current_moisture}%. Run sprinkler for {round(runtime_min)} minutes."
        elif urg == "high":
            message = f"⚠️ Irrigate TODAY. Moisture at {req.current_moisture}%, below optimal {opt_low}%. Need ~{round(water_liters)}L ({round(runtime_min)} min sprinkler)."
        else:
            message = f"💧 Irrigation recommended. Moisture at {req.current_moisture}%. Run sprinkler for ~{round(runtime_min)} minutes."
    else:
        if days_until < 1:
            message = f"✅ No irrigation needed right now, but check again in {round(hours_until)} hours."
        elif days_until < 2:
            message = f"✅ No irrigation needed today. Next irrigation in ~{round(days_until, 1)} day."
        else:
            message = f"✅ All good! Next irrigation after ~{round(days_until)} days. Moisture is healthy at {req.current_moisture}%."

    # Store in schedule
    next_dt = datetime.now() + timedelta(hours=hours_until)
    SCHEDULES[req.zone_id] = {
        "zone_id": req.zone_id,
        "zone_name": req.zone_id,
        "next_irrigation": next_dt.isoformat(),
        "hours_remaining": hours_until,
        "urgency": urg,
        "water_needed_liters": round(water_liters, 1),
        "sprinkler_runtime_minutes": round(runtime_min, 1),
    }

    return IrrigationRecommendation(
        should_irrigate=should_irrigate,
        urgency=urg,
        water_needed_liters=round(water_liters, 1),
        sprinkler_runtime_minutes=round(runtime_min, 1),
        next_irrigation_in_hours=hours_until,
        message=message,
        daily_water_loss_percent=daily_loss,
        reasoning=reasoning,
    )


@router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule():
    """Get upcoming irrigation schedule for all zones"""
    entries = [ScheduleEntry(**s) for s in SCHEDULES.values()]
    entries.sort(key=lambda e: e.hours_remaining)
    return ScheduleResponse(
        schedule=entries,
        generated_at=datetime.now().isoformat(),
    )
