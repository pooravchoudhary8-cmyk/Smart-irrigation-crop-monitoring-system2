/**
 * Intelligence Engine Routes
 * ──────────────────────────────
 * REST endpoints that expose the AI Intelligence Engine to the frontend.
 * These allow the dashboard to manually query specific AI modules
 * (e.g., on page load or on-demand).
 *
 * The real-time pipeline (Socket.IO) handles automatic updates,
 * but these routes enable:
 *   - Initial data load when dashboard opens
 *   - Manual refresh of specific modules
 *   - Health status queries
 *
 * NEW: Data Fusion Intelligence Engine endpoints (GET /api/intelligence/:farm_id)
 */
import { Router } from "express";
import {
    checkEngineHealth,
    getIrrigationRecommendation,
    getIrrigationSchedule,
    getWaterSummary,
    getWaterTrend,
    getActiveAlerts,
    getZoneMap,
    analyzeFailures,
    calibrateReading,
    getCalibrationProfiles,
} from "../services/aiEngine.service.js";
import {
    getIntelligence,
    getDecisionWithData,
    getFarmConfig,
    setFarmConfig,
    logIrrigationEvent,
} from "../controller/intelligence.controller.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  DATA FUSION INTELLIGENCE ENGINE (NEW — Primary API)
// ═══════════════════════════════════════════════════════════════════

// 🧠 Full Intelligence Report — powers ALL dashboard cards
router.get("/intelligence/:farm_id", getIntelligence);

// 🧠 Generate decision with live sensor data
router.post("/intelligence/:farm_id/decide", getDecisionWithData);

// 🌱 Crop Configuration (CRUD)
router.get("/intelligence/:farm_id/config", getFarmConfig);
router.put("/intelligence/:farm_id/config", setFarmConfig);

// 💧 Log Irrigation Event
router.post("/intelligence/:farm_id/log-irrigation", logIrrigationEvent);

// ═══════════════════════════════════════════════════════════════════
//  AI ENGINE PROXY ROUTES (Existing — FastAPI 5-module system)
// ═══════════════════════════════════════════════════════════════════

// ── Health Check ────────────────────────────────────────────────
router.get("/intelligence/health", async (_req, res) => {
    try {
        const health = await checkEngineHealth();
        res.json(health);
    } catch (err) {
        res.json({ healthy: false, error: err.message });
    }
});

// ── Irrigation Recommendation ───────────────────────────────────
router.post("/intelligence/irrigation/recommend", async (req, res) => {
    try {
        const result = await getIrrigationRecommendation(req.body);
        if (!result) {
            return res
                .status(503)
                .json({ error: "Intelligence Engine unreachable" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Irrigation Schedule ─────────────────────────────────────────
router.get("/intelligence/irrigation/schedule", async (_req, res) => {
    try {
        const result = await getIrrigationSchedule();
        if (!result) {
            return res
                .status(503)
                .json({ error: "Intelligence Engine unreachable" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Water Analytics Summary ─────────────────────────────────────
router.get("/intelligence/water/summary", async (_req, res) => {
    try {
        const result = await getWaterSummary();
        if (!result) {
            return res
                .status(503)
                .json({ error: "Intelligence Engine unreachable" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Water Usage Trend ───────────────────────────────────────────
router.get("/intelligence/water/trend", async (_req, res) => {
    try {
        const result = await getWaterTrend();
        if (!result) {
            return res
                .status(503)
                .json({ error: "Intelligence Engine unreachable" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Failure / Anomaly Alerts ────────────────────────────────────
router.get("/intelligence/alerts", async (_req, res) => {
    try {
        const result = await getActiveAlerts();
        if (!result) {
            return res
                .status(503)
                .json({ error: "Intelligence Engine unreachable" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Zone Moisture Map ───────────────────────────────────────────
router.get("/intelligence/zones/map", async (_req, res) => {
    try {
        const result = await getZoneMap();
        if (!result) {
            return res
                .status(503)
                .json({ error: "Intelligence Engine unreachable" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Calibration Profiles ────────────────────────────────────────
router.get("/intelligence/calibration/profiles", async (_req, res) => {
    try {
        const result = await getCalibrationProfiles();
        if (!result) {
            return res
                .status(503)
                .json({ error: "Intelligence Engine unreachable" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

