"""
🧪 Test Script — Intelligence Engine
Run all endpoints and verify they work.

Usage: python test_all.py
"""
import json
import sys
import time

# Use urllib (built-in, no dependencies needed)
from urllib.request import Request, urlopen
from urllib.error import URLError

BASE = "http://localhost:8001"


def post(path, data):
    req = Request(
        f"{BASE}{path}",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    resp = urlopen(req)
    return json.loads(resp.read().decode())


def get(path):
    resp = urlopen(f"{BASE}{path}")
    return json.loads(resp.read().decode())


def test(name, fn):
    try:
        result = fn()
        print(f"  ✅ {name}")
        return result
    except Exception as e:
        print(f"  ❌ {name}: {e}")
        return None


def main():
    print("\n🌾 Intelligence Engine — Full Test Suite\n")
    print("=" * 55)

    # ── Health ──
    print("\n🏥 Health Check")
    test("GET /health", lambda: get("/health"))

    # ── Module 1: Calibration ──
    print("\n🔧 Module 1: Sensor Calibration")
    test("Calibrate sensor_A1 (dry=3800, wet=1200)", lambda: post("/calibration/calibrate", {
        "sensor_id": "sensor_A1",
        "dry_value": 3800,
        "wet_value": 1200,
        "sensor_type": "capacitive",
        "label": "Zone A Sensor"
    }))
    test("Calibrate sensor_B1 (inverted: dry=500, wet=3500)", lambda: post("/calibration/calibrate", {
        "sensor_id": "sensor_B1",
        "dry_value": 500,
        "wet_value": 3500,
        "sensor_type": "resistive",
        "label": "Zone B Sensor"
    }))
    r = test("Convert raw=2500 for sensor_A1", lambda: post("/calibration/convert", {
        "sensor_id": "sensor_A1",
        "raw_value": 2500
    }))
    if r:
        print(f"     → Moisture: {r['moisture_percent']}% ({r['quality']})")

    r = test("Convert raw=2000 for sensor_B1", lambda: post("/calibration/convert", {
        "sensor_id": "sensor_B1",
        "raw_value": 2000
    }))
    if r:
        print(f"     → Moisture: {r['moisture_percent']}% ({r['quality']})")

    test("Convert uncalibrated sensor_C1 (fallback)", lambda: post("/calibration/convert", {
        "sensor_id": "sensor_C1",
        "raw_value": 2000
    }))
    test("GET /calibration/profiles", lambda: get("/calibration/profiles"))

    # ── Module 2: Zone Intelligence ──
    print("\n🗺️  Module 2: Zone Intelligence")
    test("Configure 4 zones", lambda: post("/zones/configure", {
        "zones": [
            {"zone_id": "zone_A", "name": "North Plot",  "sensor_id": "sensor_A1", "crop_type": "Wheat", "soil_type": "Loamy", "position_x": 0,   "position_y": 0,   "area_sqm": 2000},
            {"zone_id": "zone_B", "name": "South Plot",  "sensor_id": "sensor_B1", "crop_type": "Wheat", "soil_type": "Loamy", "position_x": 100, "position_y": 0,   "area_sqm": 2000},
            {"zone_id": "zone_C", "name": "East Plot",   "sensor_id": None,        "crop_type": "Rice",  "soil_type": "Clay",  "position_x": 50,  "position_y": 80,  "area_sqm": 1500},
            {"zone_id": "zone_D", "name": "Center Plot", "sensor_id": None,        "crop_type": "Wheat", "soil_type": "Sandy", "position_x": 50,  "position_y": 0,   "area_sqm": 1000},
        ]
    }))
    r = test("Estimate all zones from 2 sensors", lambda: post("/zones/estimate", {
        "readings": [
            {"sensor_id": "sensor_A1", "moisture_percent": 45.0, "temperature": 32, "humidity": 55},
            {"sensor_id": "sensor_B1", "moisture_percent": 38.0, "temperature": 32, "humidity": 55},
        ]
    }))
    if r:
        for z in r.get("zones", []):
            src = "📡" if z["source"] == "sensor" else "🧠"
            print(f"     {src} {z['name']}: {z['estimated_moisture']}% [{z['status']}] (conf: {z['confidence']})")

    # ── Module 3: Irrigation Recommender ──
    print("\n🌧️  Module 3: Irrigation Recommender")
    r = test("Recommend for zone_A (moisture=45%)", lambda: post("/irrigation/recommend", {
        "zone_id": "zone_A",
        "current_moisture": 45.0,
        "temperature": 32,
        "humidity": 55,
        "wind_speed": 8,
        "crop_type": "Wheat",
        "soil_type": "Loamy",
        "crop_stage": "vegetative",
        "sprinkler_flow_rate": 15,
        "field_area_sqm": 2000,
    }))
    if r:
        print(f"     → {r['message']}")
        print(f"     → Water: {r['water_needed_liters']}L | Runtime: {r['sprinkler_runtime_minutes']}min")

    r = test("Recommend for zone_C (moisture=20%, CRITICAL)", lambda: post("/irrigation/recommend", {
        "zone_id": "zone_C",
        "current_moisture": 20.0,
        "temperature": 40,
        "humidity": 25,
        "crop_type": "Rice",
        "crop_stage": "flowering",
        "sprinkler_flow_rate": 20,
        "field_area_sqm": 1500,
    }))
    if r:
        print(f"     → {r['message']}")

    test("GET /irrigation/schedule", lambda: get("/irrigation/schedule"))

    # ── Module 4: Water Analytics ──
    print("\n💧 Module 4: Water Analytics")
    test("Log irrigation 1 (zone_A, 30min)", lambda: post("/analytics/log-irrigation", {
        "zone_id": "zone_A", "duration_minutes": 30, "flow_rate_lpm": 15, "method": "sprinkler"
    }))
    test("Log irrigation 2 (zone_B, 25min)", lambda: post("/analytics/log-irrigation", {
        "zone_id": "zone_B", "duration_minutes": 25, "flow_rate_lpm": 15, "method": "sprinkler"
    }))
    test("Log irrigation 3 (zone_C, 45min)", lambda: post("/analytics/log-irrigation", {
        "zone_id": "zone_C", "duration_minutes": 45, "flow_rate_lpm": 20, "method": "sprinkler"
    }))
    r = test("GET /analytics/summary", lambda: get("/analytics/summary"))
    if r:
        print(f"     → {r['message']}")
        print(f"     → Total used: {r['total_water_used_liters']}L | Flood equivalent: {r['flood_equivalent_liters']}L")
        print(f"     → Saved: {r['water_saved_liters']}L ({r['saving_percent']}%)")

    test("GET /analytics/trend", lambda: get("/analytics/trend"))

    # ── Module 5: Failure Detection ──
    print("\n🚨 Module 5: Failure Detection")
    r = test("Analyze — dead sensor scenario", lambda: post("/failures/analyze", {
        "readings": [
            {"sensor_id": "sensor_X", "moisture": 42.0, "timestamp": "2026-02-24T10:00:00"},
            {"sensor_id": "sensor_X", "moisture": 42.0, "timestamp": "2026-02-24T10:05:00"},
            {"sensor_id": "sensor_X", "moisture": 42.0, "timestamp": "2026-02-24T10:10:00"},
            {"sensor_id": "sensor_X", "moisture": 42.0, "timestamp": "2026-02-24T10:15:00"},
            {"sensor_id": "sensor_X", "moisture": 42.0, "timestamp": "2026-02-24T10:20:00"},
            {"sensor_id": "sensor_X", "moisture": 42.0, "timestamp": "2026-02-24T10:25:00"},
        ],
        "motor_was_on": False,
        "irrigation_happened": False,
    }))
    if r:
        print(f"     → Health: {r['system_health']} (score: {r['health_score']})")
        for a in r.get("alerts", []):
            print(f"     → 🔴 [{a['severity'].upper()}] {a['type']}: {a['description'][:80]}...")

    r = test("Analyze — spike + leak scenario", lambda: post("/failures/analyze", {
        "readings": [
            {"sensor_id": "sensor_Y", "moisture": 45.0},
            {"sensor_id": "sensor_Y", "moisture": 92.0},
            {"sensor_id": "sensor_Y", "moisture": 43.0},
            {"sensor_id": "sensor_Z", "moisture": 60.0},
            {"sensor_id": "sensor_Z", "moisture": 55.0},
            {"sensor_id": "sensor_Z", "moisture": 48.0},
        ],
        "motor_was_on": False,
        "irrigation_happened": True,
    }))
    if r:
        print(f"     → Health: {r['system_health']} (score: {r['health_score']})")
        for a in r.get("alerts", []):
            print(f"     → 🔴 [{a['severity'].upper()}] {a['type']}: {a['description'][:80]}...")

    test("GET /failures/alerts", lambda: get("/failures/alerts"))

    print("\n" + "=" * 55)
    print("🎉 All tests completed!")
    print(f"📚 Full API docs: {BASE}/docs\n")


if __name__ == "__main__":
    try:
        get("/health")
    except URLError:
        print(f"❌ Cannot connect to {BASE}")
        print("   Start the server first: python main.py")
        sys.exit(1)
    main()
