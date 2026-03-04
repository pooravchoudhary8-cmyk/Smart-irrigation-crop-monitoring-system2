"""
Module 4: Water Savings Analytics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Track water usage, compare with traditional flood irrigation,
and show the farmer: "You saved 38% water this season!"

This is the IMPACT metric that wins hackathons.

USP: "Quantified water savings — real ROI for the farmer"
"""
import json
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

from fastapi import APIRouter
from models import IrrigationLogEntry, WaterSummary, WaterTrend

router = APIRouter(prefix="/analytics", tags=["Water Analytics"])

# ── In-memory store ───────────────────────────────────────────
IRRIGATION_LOG: list[dict] = []
PERSISTENCE_FILE = Path(__file__).parent.parent / "data" / "irrigation_log.json"


def _load_log():
    global IRRIGATION_LOG
    if PERSISTENCE_FILE.exists():
        with open(PERSISTENCE_FILE, "r") as f:
            IRRIGATION_LOG = json.load(f)


def _save_log():
    PERSISTENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PERSISTENCE_FILE, "w") as f:
        json.dump(IRRIGATION_LOG, f, indent=2)


_load_log()


# ── Flood irrigation baseline ────────────────────────────────
# Traditional flood irrigation typically uses 2-3x more water
# than sprinkler/drip. We use 2.5x as the comparison factor.
FLOOD_MULTIPLIER = 2.5

# Water cost in INR per liter (approximate borewell pump cost)
WATER_COST_PER_LITER = 0.05  # ~₹50 per 1000 liters


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/log-irrigation")
async def log_irrigation(entry: IrrigationLogEntry):
    """
    Log an irrigation event.
    Called after each sprinkler run to track water usage.
    """
    if entry.liters_used <= 0:
        # Calculate from duration and flow rate
        entry.liters_used = round(entry.duration_minutes * entry.flow_rate_lpm, 1)

    record = {
        "zone_id": entry.zone_id,
        "duration_minutes": entry.duration_minutes,
        "liters_used": entry.liters_used,
        "flow_rate_lpm": entry.flow_rate_lpm,
        "method": entry.method,
        "timestamp": entry.timestamp or datetime.now().isoformat(),
        "flood_equivalent": round(entry.liters_used * FLOOD_MULTIPLIER, 1),
    }

    IRRIGATION_LOG.append(record)
    _save_log()

    return {
        "success": True,
        "logged": record,
        "total_events": len(IRRIGATION_LOG),
        "message": f"Logged {record['liters_used']}L irrigation. Flood equivalent would be {record['flood_equivalent']}L."
    }


@router.get("/summary", response_model=WaterSummary)
async def get_water_summary():
    """
    Returns complete water saving analytics.
    Compares smart irrigation vs traditional flood irrigation.
    """
    if not IRRIGATION_LOG:
        return WaterSummary(
            total_water_used_liters=0,
            flood_equivalent_liters=0,
            water_saved_liters=0,
            saving_percent=0,
            cost_saved_inr=0,
            total_irrigations=0,
            avg_per_irrigation_liters=0,
            period_days=0,
            zones_breakdown=[],
            message="No irrigation data yet. Start logging irrigations to see savings!"
        )

    total_used = sum(r["liters_used"] for r in IRRIGATION_LOG)
    total_flood = sum(r["flood_equivalent"] for r in IRRIGATION_LOG)
    saved = total_flood - total_used
    saving_pct = (saved / total_flood * 100) if total_flood > 0 else 0
    cost_saved = saved * WATER_COST_PER_LITER

    # Period calculation
    timestamps = []
    for r in IRRIGATION_LOG:
        try:
            timestamps.append(datetime.fromisoformat(r["timestamp"]))
        except (ValueError, KeyError):
            pass

    if len(timestamps) >= 2:
        period = (max(timestamps) - min(timestamps)).days + 1
    else:
        period = 1

    # Per-zone breakdown
    zone_data = defaultdict(lambda: {"liters": 0, "count": 0, "flood_eq": 0})
    for r in IRRIGATION_LOG:
        zid = r.get("zone_id", "default")
        zone_data[zid]["liters"] += r["liters_used"]
        zone_data[zid]["count"] += 1
        zone_data[zid]["flood_eq"] += r["flood_equivalent"]

    zones_breakdown = []
    for zid, data in zone_data.items():
        z_saved = data["flood_eq"] - data["liters"]
        zones_breakdown.append({
            "zone_id": zid,
            "total_liters": round(data["liters"], 1),
            "irrigations": data["count"],
            "flood_equivalent": round(data["flood_eq"], 1),
            "saved_liters": round(z_saved, 1),
            "saving_percent": round(z_saved / data["flood_eq"] * 100, 1) if data["flood_eq"] > 0 else 0,
        })

    # Build impact message
    if saving_pct >= 40:
        emoji = "🏆"
        impact = "Exceptional!"
    elif saving_pct >= 25:
        emoji = "🌟"
        impact = "Great savings!"
    elif saving_pct >= 10:
        emoji = "💧"
        impact = "Good progress!"
    else:
        emoji = "📊"
        impact = "Getting started."

    message = (
        f"{emoji} {impact} You saved {round(saved)}L of water ({round(saving_pct)}% reduction) "
        f"over {period} days compared to flood irrigation. "
        f"That's ₹{round(cost_saved)} saved in water costs!"
    )

    return WaterSummary(
        total_water_used_liters=round(total_used, 1),
        flood_equivalent_liters=round(total_flood, 1),
        water_saved_liters=round(saved, 1),
        saving_percent=round(saving_pct, 1),
        cost_saved_inr=round(cost_saved, 2),
        total_irrigations=len(IRRIGATION_LOG),
        avg_per_irrigation_liters=round(total_used / len(IRRIGATION_LOG), 1),
        period_days=period,
        zones_breakdown=zones_breakdown,
        message=message,
    )


@router.get("/trend", response_model=WaterTrend)
async def get_water_trend():
    """
    Returns daily water usage trend.
    Shows if consumption is decreasing (good), stable, or increasing.
    """
    if not IRRIGATION_LOG:
        return WaterTrend(
            daily=[],
            weekly_avg_liters=0,
            trend_direction="stable",
            message="No data yet."
        )

    # Group by date
    daily_data = defaultdict(lambda: {"liters": 0, "irrigations": 0})
    for r in IRRIGATION_LOG:
        try:
            dt = datetime.fromisoformat(r["timestamp"])
            date_str = dt.strftime("%Y-%m-%d")
            daily_data[date_str]["liters"] += r["liters_used"]
            daily_data[date_str]["irrigations"] += 1
        except (ValueError, KeyError):
            pass

    daily = [
        {"date": d, "liters": round(v["liters"], 1), "irrigations": v["irrigations"]}
        for d, v in sorted(daily_data.items())
    ]

    # Weekly average
    total = sum(d["liters"] for d in daily)
    weeks = max(1, len(daily) / 7)
    weekly_avg = total / weeks

    # Trend: compare first half vs second half
    if len(daily) >= 4:
        mid = len(daily) // 2
        first_half_avg = sum(d["liters"] for d in daily[:mid]) / mid
        second_half_avg = sum(d["liters"] for d in daily[mid:]) / (len(daily) - mid)

        if second_half_avg < first_half_avg * 0.85:
            direction = "decreasing"
            msg = "📉 Water usage is decreasing! Your smart irrigation is learning."
        elif second_half_avg > first_half_avg * 1.15:
            direction = "increasing"
            msg = "📈 Water usage is increasing. Check for leaks or sensor issues."
        else:
            direction = "stable"
            msg = "📊 Water usage is stable."
    else:
        direction = "stable"
        msg = "📊 Not enough data yet for trend analysis. Keep logging!"

    return WaterTrend(
        daily=daily,
        weekly_avg_liters=round(weekly_avg, 1),
        trend_direction=direction,
        message=msg,
    )


@router.delete("/clear")
async def clear_log():
    """Clear all irrigation logs (for testing)"""
    global IRRIGATION_LOG
    IRRIGATION_LOG = []
    _save_log()
    return {"success": True, "message": "All irrigation logs cleared"}
