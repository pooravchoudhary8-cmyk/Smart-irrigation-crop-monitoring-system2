"""
Intelligence Engine - Smart Irrigation System

5-Module AI Intelligence Layer:
  1. Sensor Calibration    - Self-calibrating low-cost sensors
  2. Zone Intelligence     - Virtual moisture mapping (AI interpolation)
  3. Irrigation Recommender - Predict WHEN + HOW MUCH + sprinkler runtime
  4. Water Analytics        - Track savings vs flood irrigation
  5. Failure Detection      - Detect dead sensors, leaks, motor faults

Runs on port 8001 alongside existing ml_service (port 8000).

Start: python main.py
Docs:  http://localhost:8001/docs
"""
import sys
import os

# Fix Windows console encoding for Unicode
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from pathlib import Path

# Add parent dir so modules can import models.py
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import module routers
from modules.calibration import router as calibration_router
from modules.zone_intelligence import router as zone_router
from modules.irrigation_recommender import router as irrigation_router
from modules.water_analytics import router as analytics_router
from modules.failure_detection import router as failure_router


# ── FastAPI App ───────────────────────────────────────────────
app = FastAPI(
    title="🌾 Intelligence Engine — Smart Irrigation",
    description=(
        "AI-powered intelligence layer for smart irrigation. "
        "5 modules: Calibration, Zone Intelligence, Irrigation Recommendation, "
        "Water Analytics, Failure Detection."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Module Routers ──────────────────────────────────
app.include_router(calibration_router)
app.include_router(zone_router)
app.include_router(irrigation_router)
app.include_router(analytics_router)
app.include_router(failure_router)


# ── Health Check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "running",
        "service": "Intelligence Engine",
        "modules": 5,
        "module_list": [
            "calibration",
            "zone_intelligence",
            "irrigation_recommender",
            "water_analytics",
            "failure_detection",
        ],
        "docs_url": "/docs",
    }


# ── Root Info ─────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": "🌾 Smart Irrigation Intelligence Engine",
        "version": "1.0.0",
        "endpoints": {
            "calibration": "/calibration/calibrate, /calibration/convert, /calibration/profiles",
            "zones": "/zones/configure, /zones/estimate, /zones/map",
            "irrigation": "/irrigation/recommend, /irrigation/schedule",
            "analytics": "/analytics/log-irrigation, /analytics/summary, /analytics/trend",
            "failures": "/failures/analyze, /failures/alerts",
        },
        "docs": "/docs",
    }


# ── Run ───────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("🌾 Starting Intelligence Engine on port 8001...")
    print("📚 API Docs: http://localhost:8001/docs")
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
