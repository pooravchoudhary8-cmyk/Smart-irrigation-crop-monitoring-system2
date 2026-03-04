"""
Module 5: Failure & Anomaly Detection
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detects system failures from data patterns:
  - Dead/stuck sensors
  - Pipe/sprinkler leaks
  - Motor faults
  - Sudden spikes (sensor malfunction)

No extra hardware needed — pure data intelligence.

USP: "Failure detection without additional sensors"
"""
import uuid
from datetime import datetime
from statistics import stdev, mean

from fastapi import APIRouter
from models import (
    FailureAnalyzeRequest, FailureAlert,
    FailureAnalyzeResponse, SensorDataPoint,
)

router = APIRouter(prefix="/failures", tags=["Failure Detection"])

# ── In-memory alert store ─────────────────────────────────────
ACTIVE_ALERTS: list[FailureAlert] = []

# ── Detection thresholds ──────────────────────────────────────
STUCK_THRESHOLD = 0.5         # Max variance to consider sensor "stuck"
STUCK_MIN_READINGS = 5        # Minimum readings to detect stuck sensor
SPIKE_THRESHOLD = 40.0        # Max allowed jump between consecutive readings
LEAK_MOISTURE_DROP = 5.0      # If moisture drops this much after irrigation → leak
MOTOR_NO_CHANGE_THRESH = 3.0  # If moisture doesn't change by this much when motor is ON


def _detect_stuck_sensor(readings: list[SensorDataPoint]) -> list[FailureAlert]:
    """
    Detect if a sensor is sending the same value repeatedly (dead sensor).
    """
    alerts = []

    # Group by sensor_id
    sensor_groups: dict[str, list[float]] = {}
    for r in readings:
        sensor_groups.setdefault(r.sensor_id, []).append(r.moisture)

    for sid, values in sensor_groups.items():
        if len(values) < STUCK_MIN_READINGS:
            continue

        # Check if all values are nearly identical
        if len(set(values)) == 1 or (len(values) > 1 and stdev(values) < STUCK_THRESHOLD):
            alerts.append(FailureAlert(
                alert_id=f"stuck_{sid}_{uuid.uuid4().hex[:6]}",
                type="sensor_dead",
                severity="high",
                sensor_id=sid,
                description=(
                    f"Sensor '{sid}' appears DEAD — readings stuck at {values[0]}% "
                    f"across {len(values)} consecutive readings. "
                    f"Check physical connection or replace sensor."
                ),
                detected_at=datetime.now().isoformat(),
            ))

    return alerts


def _detect_spikes(readings: list[SensorDataPoint]) -> list[FailureAlert]:
    """
    Detect impossible jumps in sensor readings (malfunction).
    """
    alerts = []

    sensor_groups: dict[str, list[float]] = {}
    for r in readings:
        sensor_groups.setdefault(r.sensor_id, []).append(r.moisture)

    for sid, values in sensor_groups.items():
        for i in range(1, len(values)):
            jump = abs(values[i] - values[i - 1])
            if jump > SPIKE_THRESHOLD:
                alerts.append(FailureAlert(
                    alert_id=f"spike_{sid}_{uuid.uuid4().hex[:6]}",
                    type="sensor_spike",
                    severity="medium",
                    sensor_id=sid,
                    description=(
                        f"Sensor '{sid}' had an impossible jump: "
                        f"{values[i-1]}% → {values[i]}% (Δ{round(jump, 1)}%) in one reading. "
                        f"Possible loose wire or electrical interference."
                    ),
                    detected_at=datetime.now().isoformat(),
                ))
                break  # One alert per sensor

    return alerts


def _detect_leak(readings: list[SensorDataPoint], irrigation_happened: bool) -> list[FailureAlert]:
    """
    If irrigation just happened but moisture is DROPPING → possible pipe/sprinkler leak.
    """
    alerts = []

    if not irrigation_happened:
        return alerts

    sensor_groups: dict[str, list[float]] = {}
    for r in readings:
        sensor_groups.setdefault(r.sensor_id, []).append(r.moisture)

    for sid, values in sensor_groups.items():
        if len(values) < 3:
            continue

        # After irrigation, moisture should increase or stay stable
        # Check if there's a consistent drop
        recent = values[-3:]  # Last 3 readings
        if all(recent[i] < recent[i-1] for i in range(1, len(recent))):
            total_drop = recent[0] - recent[-1]
            if total_drop > LEAK_MOISTURE_DROP:
                alerts.append(FailureAlert(
                    alert_id=f"leak_{sid}_{uuid.uuid4().hex[:6]}",
                    type="pipe_leak",
                    severity="high",
                    sensor_id=sid,
                    description=(
                        f"⚠️ Moisture DROPPING after irrigation near sensor '{sid}': "
                        f"{recent[0]}% → {recent[-1]}% (lost {round(total_drop, 1)}%). "
                        f"Possible pipe leak, sprinkler malfunction, or blockage in the line."
                    ),
                    detected_at=datetime.now().isoformat(),
                ))

    return alerts


def _detect_motor_fault(readings: list[SensorDataPoint], motor_was_on: bool) -> list[FailureAlert]:
    """
    Motor is ON but moisture isn't increasing → motor fault or empty borewell.
    """
    alerts = []

    if not motor_was_on:
        return alerts

    sensor_groups: dict[str, list[float]] = {}
    for r in readings:
        sensor_groups.setdefault(r.sensor_id, []).append(r.moisture)

    for sid, values in sensor_groups.items():
        if len(values) < 3:
            continue

        change = values[-1] - values[0]
        if abs(change) < MOTOR_NO_CHANGE_THRESH:
            alerts.append(FailureAlert(
                alert_id=f"motor_{sid}_{uuid.uuid4().hex[:6]}",
                type="motor_fault",
                severity="high",
                sensor_id=sid,
                description=(
                    f"🔧 Motor was ON but moisture near sensor '{sid}' didn't change "
                    f"({values[0]}% → {values[-1]}%, Δ{round(change, 1)}%). "
                    f"Possible causes: motor dry run, empty borewell, broken impeller, or clogged pipe."
                ),
                detected_at=datetime.now().isoformat(),
            ))

    return alerts


def _detect_drift(readings: list[SensorDataPoint]) -> list[FailureAlert]:
    """
    Detect gradual sensor drift — readings slowly moving in one direction
    without corresponding real-world changes.
    """
    alerts = []

    sensor_groups: dict[str, list[float]] = {}
    for r in readings:
        sensor_groups.setdefault(r.sensor_id, []).append(r.moisture)

    for sid, values in sensor_groups.items():
        if len(values) < 8:
            continue

        # Check for monotonic trend (all increasing or all decreasing)
        diffs = [values[i] - values[i-1] for i in range(1, len(values))]
        increasing = sum(1 for d in diffs if d > 0.1)
        decreasing = sum(1 for d in diffs if d < -0.1)

        total = len(diffs)
        if increasing > total * 0.85 or decreasing > total * 0.85:
            direction = "increasing" if increasing > decreasing else "decreasing"
            total_change = values[-1] - values[0]
            alerts.append(FailureAlert(
                alert_id=f"drift_{sid}_{uuid.uuid4().hex[:6]}",
                type="sensor_drift",
                severity="low",
                sensor_id=sid,
                description=(
                    f"Sensor '{sid}' shows gradual {direction} drift: "
                    f"{values[0]}% → {values[-1]}% (Δ{round(total_change, 1)}%) over {len(values)} readings. "
                    f"Consider re-calibrating the sensor."
                ),
                detected_at=datetime.now().isoformat(),
            ))

    return alerts


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/analyze", response_model=FailureAnalyzeResponse)
async def analyze_failures(req: FailureAnalyzeRequest):
    """
    Analyze a batch of sensor readings for anomalies.
    Run this periodically (e.g., every 5 minutes) with recent readings.
    """
    global ACTIVE_ALERTS

    all_alerts: list[FailureAlert] = []

    # Run all detectors
    all_alerts.extend(_detect_stuck_sensor(req.readings))
    all_alerts.extend(_detect_spikes(req.readings))
    all_alerts.extend(_detect_leak(req.readings, req.irrigation_happened))
    all_alerts.extend(_detect_motor_fault(req.readings, req.motor_was_on))
    all_alerts.extend(_detect_drift(req.readings))

    # Update active alerts
    ACTIVE_ALERTS.extend(all_alerts)
    # Keep only last 50 alerts
    ACTIVE_ALERTS = ACTIVE_ALERTS[-50:]

    # Calculate health score
    severity_scores = {"low": 5, "medium": 15, "high": 30}
    penalty = sum(severity_scores.get(a.severity, 10) for a in all_alerts)
    health_score = max(0, 100 - penalty)

    if health_score >= 80:
        health = "healthy"
        message = "✅ System is healthy. No anomalies detected."
    elif health_score >= 50:
        health = "warning"
        message = f"⚠️ {len(all_alerts)} issue(s) detected. Review alerts below."
    else:
        health = "critical"
        message = f"🚨 CRITICAL: {len(all_alerts)} serious issue(s) found! Immediate attention needed."

    return FailureAnalyzeResponse(
        alerts=all_alerts,
        system_health=health,
        health_score=health_score,
        message=message,
    )


@router.get("/alerts")
async def get_active_alerts():
    """Get all active failure alerts"""
    unresolved = [a for a in ACTIVE_ALERTS if not a.resolved]
    return {
        "count": len(unresolved),
        "alerts": [a.model_dump() for a in unresolved],
        "total_historical": len(ACTIVE_ALERTS),
    }


@router.post("/resolve/{alert_id}")
async def resolve_alert(alert_id: str):
    """Mark an alert as resolved"""
    for alert in ACTIVE_ALERTS:
        if alert.alert_id == alert_id:
            alert.resolved = True
            return {"success": True, "message": f"Alert {alert_id} resolved"}
    return {"success": False, "error": "Alert not found"}


@router.delete("/clear")
async def clear_alerts():
    """Clear all alerts (for testing)"""
    global ACTIVE_ALERTS
    ACTIVE_ALERTS = []
    return {"success": True, "message": "All alerts cleared"}
