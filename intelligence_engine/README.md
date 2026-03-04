# 🌾 Intelligence Engine — Integration Guide

> **For your friend**: Drop this folder alongside the existing project and run as a separate service.

## Quick Start

```bash
cd intelligence_engine
pip install -r requirements.txt
python main.py
```

Service starts on **http://localhost:8001**  
API Docs: **http://localhost:8001/docs** (interactive Swagger UI)

---

## Architecture

```
Existing Project (ports 5001 + 8000)     Intelligence Engine (port 8001)
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│ Backend (Node.js :5001)         │     │ FastAPI Python Service :8001     │
│   ├── MQTT → sensor data        │────▶│   ├── /calibration/*             │
│   ├── Socket.IO → frontend      │     │   ├── /zones/*                   │
│   └── MongoDB                   │     │   ├── /irrigation/*              │
│                                 │     │   ├── /analytics/*               │
│ ML Service (Python :8000)       │     │   └── /failures/*                │
│   ├── RAG chatbot               │     └──────────────────────────────────┘
│   └── Irrigation check          │
└─────────────────────────────────┘
```

---

## 5 Modules & Endpoints

### Module 1: Sensor Calibration 🔧

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/calibration/calibrate` | Calibrate a sensor (dry + wet readings) |
| POST | `/calibration/convert` | Convert raw ADC → calibrated moisture % |
| GET | `/calibration/profiles` | List all calibration profiles |

**Example — Calibrate a sensor:**
```bash
curl -X POST http://localhost:8001/calibration/calibrate \
  -H "Content-Type: application/json" \
  -d '{"sensor_id":"sensor_A1","dry_value":3800,"wet_value":1200,"sensor_type":"capacitive"}'
```

**Example — Convert reading:**
```bash
curl -X POST http://localhost:8001/calibration/convert \
  -H "Content-Type: application/json" \
  -d '{"sensor_id":"sensor_A1","raw_value":2500}'
```

---

### Module 2: Zone Intelligence 🗺️

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/zones/configure` | Define field zones |
| POST | `/zones/estimate` | Estimate moisture for ALL zones from sensor readings |
| GET | `/zones/map` | Get latest virtual moisture map |
| GET | `/zones/config` | Get zone configuration |

**Example — Estimate moisture map:**
```bash
curl -X POST http://localhost:8001/zones/estimate \
  -H "Content-Type: application/json" \
  -d '{"readings":[{"sensor_id":"sensor_A1","moisture_percent":45},{"sensor_id":"sensor_B1","moisture_percent":38}]}'
```

---

### Module 3: Irrigation Recommender 🌧️

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/irrigation/recommend` | Get irrigation recommendation |
| GET | `/irrigation/schedule` | Get schedule for all zones |

**Example — Get recommendation:**
```bash
curl -X POST http://localhost:8001/irrigation/recommend \
  -H "Content-Type: application/json" \
  -d '{"current_moisture":35,"temperature":32,"humidity":50,"crop_type":"Wheat","crop_stage":"vegetative","sprinkler_flow_rate":15,"field_area_sqm":2000}'
```

**Response includes:**
- `should_irrigate` — yes/no
- `water_needed_liters` — exact amount
- `sprinkler_runtime_minutes` — how long to run sprinkler
- `next_irrigation_in_hours` — when next irrigation is needed
- `message` — human-readable like *"Next irrigation after 2 days"*

---

### Module 4: Water Analytics 💧

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analytics/log-irrigation` | Log an irrigation event |
| GET | `/analytics/summary` | Water savings summary |
| GET | `/analytics/trend` | Daily usage trend |

**Example — Log irrigation:**
```bash
curl -X POST http://localhost:8001/analytics/log-irrigation \
  -H "Content-Type: application/json" \
  -d '{"zone_id":"zone_A","duration_minutes":30,"flow_rate_lpm":15,"method":"sprinkler"}'
```

**Example response from `/analytics/summary`:**
```json
{
  "total_water_used_liters": 1575.0,
  "flood_equivalent_liters": 3937.5,
  "water_saved_liters": 2362.5,
  "saving_percent": 60.0,
  "cost_saved_inr": 118.13,
  "message": "🏆 Exceptional! You saved 2363L of water (60% reduction)..."
}
```

---

### Module 5: Failure Detection 🚨

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/failures/analyze` | Analyze sensor data for anomalies |
| GET | `/failures/alerts` | Get active alerts |
| POST | `/failures/resolve/{id}` | Resolve an alert |

**Example — Analyze for failures:**
```bash
curl -X POST http://localhost:8001/failures/analyze \
  -H "Content-Type: application/json" \
  -d '{"readings":[{"sensor_id":"s1","moisture":42},{"sensor_id":"s1","moisture":42},{"sensor_id":"s1","moisture":42},{"sensor_id":"s1","moisture":42},{"sensor_id":"s1","moisture":42},{"sensor_id":"s1","moisture":42}]}'
```

**Detects:** Dead sensors, impossible spikes, pipe leaks, motor faults, sensor drift.

---

## Integration with Node.js Backend

Add this to your Node.js backend to call the Intelligence Engine:

```javascript
// intelligence.service.js — Add to Backend/src/services/

const INTELLIGENCE_URL = process.env.INTELLIGENCE_URL || "http://localhost:8001";

export const getIrrigationRecommendation = async (data) => {
  const response = await fetch(`${INTELLIGENCE_URL}/irrigation/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
};

export const analyzeFailures = async (readings) => {
  const response = await fetch(`${INTELLIGENCE_URL}/failures/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readings })
  });
  return response.json();
};

export const getWaterSummary = async () => {
  const response = await fetch(`${INTELLIGENCE_URL}/analytics/summary`);
  return response.json();
};
```

---

## File Structure

```
intelligence_engine/
├── main.py                  # FastAPI app entrypoint (port 8001)
├── models.py                # All Pydantic request/response models
├── requirements.txt         # Python dependencies
├── test_all.py              # Test script for all endpoints
├── README.md                # This file
├── data/                    # Auto-created: persisted JSON data
│   ├── calibration_profiles.json
│   ├── zones_config.json
│   └── irrigation_log.json
└── modules/
    ├── __init__.py
    ├── calibration.py           # Module 1: Sensor Calibration
    ├── zone_intelligence.py     # Module 2: Zone-Based Intelligence
    ├── irrigation_recommender.py # Module 3: Irrigation Recommender
    ├── water_analytics.py       # Module 4: Water Savings Analytics
    └── failure_detection.py     # Module 5: Failure & Anomaly Detection
```

## Running Tests

```bash
# Start the server first
python main.py

# In another terminal
python test_all.py
```
