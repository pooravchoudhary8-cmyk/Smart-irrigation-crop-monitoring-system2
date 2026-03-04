/**
 * AI Intelligence Engine Service
 * ────────────────────────────────
 * Clean service layer for communicating with the FastAPI Intelligence Engine.
 *
 * All 5 AI modules are accessed through this single service:
 *   1. Sensor Calibration      → /calibration/*
 *   2. Zone Intelligence        → /zones/*
 *   3. Irrigation Recommender   → /irrigation/*
 *   4. Water Analytics          → /analytics/*
 *   5. Failure Detection        → /failures/*
 *
 * Design principles:
 *   - Single Responsibility: only handles HTTP communication with the engine
 *   - Fail-safe: returns null/fallback if engine is unreachable
 *   - No business logic here — that stays in the FastAPI engine
 *   - Structured logging for observability
 */
import dotenv from "dotenv";
dotenv.config();

const ENGINE_BASE_URL =
    process.env.INTELLIGENCE_ENGINE_URL || "http://localhost:8001";

// ── Health tracking ─────────────────────────────────────────────
let engineHealthy = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 s

/**
 * Generic POST helper with timeout and error handling.
 * Returns parsed JSON on success, null on failure.
 */
async function postToEngine(path, payload, timeoutMs = 5000) {
    const url = `${ENGINE_BASE_URL}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
            console.warn(
                `⚠️  [AI ENGINE] ${path} returned HTTP ${res.status}`
            );
            return null;
        }

        const data = await res.json();
        engineHealthy = true;
        return data;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
            console.warn(`⏱️  [AI ENGINE] ${path} timed out (${timeoutMs}ms)`);
        } else {
            console.error(`❌ [AI ENGINE] ${path} error:`, err.message);
        }
        engineHealthy = false;
        return null;
    }
}

/**
 * Generic GET helper.
 */
async function getFromEngine(path, timeoutMs = 5000) {
    const url = `${ENGINE_BASE_URL}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: "GET",
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
            console.warn(
                `⚠️  [AI ENGINE] GET ${path} returned HTTP ${res.status}`
            );
            return null;
        }

        const data = await res.json();
        engineHealthy = true;
        return data;
    } catch (err) {
        clearTimeout(timer);
        engineHealthy = false;
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API — one method per Intelligence Engine endpoint
// ═══════════════════════════════════════════════════════════════

/**
 * Health check — lightweight ping to /health
 */
export async function checkEngineHealth() {
    const now = Date.now();
    if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
        return { healthy: engineHealthy };
    }
    lastHealthCheck = now;

    const result = await getFromEngine("/health", 3000);
    engineHealthy = !!result;
    return {
        healthy: engineHealthy,
        ...(result || {}),
    };
}

/**
 * Returns whether the engine was last known to be healthy.
 * Useful for fast synchronous checks without making a request.
 */
export function isEngineHealthy() {
    return engineHealthy;
}

// ── Module 1: Sensor Calibration ────────────────────────────────

/**
 * Convert a raw ADC reading → calibrated moisture %
 */
export async function calibrateReading(sensorId, rawValue) {
    return postToEngine("/calibration/convert", {
        sensor_id: sensorId,
        raw_value: rawValue,
    });
}

/**
 * Get all calibration profiles
 */
export async function getCalibrationProfiles() {
    return getFromEngine("/calibration/profiles");
}

// ── Module 2: Zone Intelligence ─────────────────────────────────

/**
 * Estimate moisture for all configured zones using available sensor readings.
 *
 * @param {Array} readings - [{ sensor_id, moisture_percent, temperature, humidity }]
 * @param {Object} weather - optional { wind_speed, forecast_rain }
 */
export async function estimateZones(readings, weather = null) {
    return postToEngine("/zones/estimate", { readings, weather });
}

/**
 * Get the latest virtual moisture map
 */
export async function getZoneMap() {
    return getFromEngine("/zones/map");
}

// ── Module 3: Irrigation Recommender ────────────────────────────

/**
 * Get AI-powered irrigation recommendation.
 *
 * @param {Object} params
 *   - current_moisture: number
 *   - temperature: number
 *   - humidity: number
 *   - wind_speed: number
 *   - crop_type: string
 *   - soil_type: string
 *   - crop_stage: string
 *   - sprinkler_flow_rate: number (default 15)
 *   - field_area_sqm: number (default 1000)
 */
export async function getIrrigationRecommendation(params) {
    return postToEngine("/irrigation/recommend", {
        zone_id: params.zone_id || "default",
        current_moisture: params.current_moisture,
        temperature: params.temperature ?? 30,
        humidity: params.humidity ?? 50,
        wind_speed: params.wind_speed ?? 5,
        crop_type: params.crop_type || "Wheat",
        soil_type: params.soil_type || "Loamy",
        crop_stage: params.crop_stage || "vegetative",
        sprinkler_flow_rate: params.sprinkler_flow_rate ?? 15,
        field_area_sqm: params.field_area_sqm ?? 1000,
        last_irrigation_hours_ago: params.last_irrigation_hours_ago ?? 24,
    });
}

/**
 * Get irrigation schedule for all zones
 */
export async function getIrrigationSchedule() {
    return getFromEngine("/irrigation/schedule");
}

// ── Module 4: Water Analytics ───────────────────────────────────

/**
 * Log an irrigation event for water savings tracking.
 */
export async function logIrrigationEvent(entry) {
    return postToEngine("/analytics/log-irrigation", {
        zone_id: entry.zone_id || "default",
        duration_minutes: entry.duration_minutes,
        liters_used: entry.liters_used || 0,
        flow_rate_lpm: entry.flow_rate_lpm || 15,
        method: entry.method || "sprinkler",
        timestamp: entry.timestamp || new Date().toISOString(),
    });
}

/**
 * Get water savings summary (total used vs flood equivalent)
 */
export async function getWaterSummary() {
    return getFromEngine("/analytics/summary");
}

/**
 * Get daily water usage trend
 */
export async function getWaterTrend() {
    return getFromEngine("/analytics/trend");
}

// ── Module 5: Failure Detection ─────────────────────────────────

/**
 * Analyze a batch of sensor readings for anomalies.
 *
 * @param {Array}   readings  - [{ sensor_id, moisture, temperature, humidity, timestamp }]
 * @param {boolean} motorWasOn
 * @param {boolean} irrigationHappened
 */
export async function analyzeFailures(
    readings,
    motorWasOn = false,
    irrigationHappened = false
) {
    return postToEngine("/failures/analyze", {
        readings,
        motor_was_on: motorWasOn,
        irrigation_happened: irrigationHappened,
    });
}

/**
 * Get currently active failure alerts
 */
export async function getActiveAlerts() {
    return getFromEngine("/failures/alerts");
}

// ── Composite: Full Intelligence Pipeline ───────────────────────

/**
 * Runs the complete intelligence pipeline on incoming sensor data.
 * Called by intelligence.service.js on every MQTT message (throttled).
 *
 * Returns a unified result object with all module outputs.
 * If the engine is down, returns null — caller should fallback gracefully.
 */
export async function runFullPipeline(sensorData, meta = {}) {
    // Quick health gate — skip pipeline if engine was recently unreachable
    if (!engineHealthy) {
        const health = await checkEngineHealth();
        if (!health.healthy) {
            return null;
        }
    }

    // Run modules in parallel for performance
    const [irrigationRec, failureAnalysis, waterSummary] =
        await Promise.all([
            // Irrigation recommendation
            getIrrigationRecommendation({
                current_moisture: sensorData.soil_moisture ?? 50,
                temperature: sensorData.temperature ?? 30,
                humidity: sensorData.humidity ?? 50,
                wind_speed: meta.wind_speed ?? 5,
                crop_type: meta.crop_type || "Wheat",
                soil_type: meta.soil_type || "Loamy",
                crop_stage: meta.crop_stage || "vegetative",
            }),

            // Failure detection
            analyzeFailures(
                [
                    {
                        sensor_id: "soil_primary",
                        moisture: sensorData.soil_moisture ?? 0,
                        temperature: sensorData.temperature ?? 0,
                        humidity: sensorData.humidity ?? 0,
                        timestamp: new Date().toISOString(),
                    },
                ],
                meta.pumpOn ?? false,
                meta.irrigationHappened ?? false
            ),

            // Water analytics summary
            getWaterSummary(),
        ]);

    return {
        irrigation: irrigationRec,
        failures: failureAnalysis,
        waterAnalytics: waterSummary,
        engineHealthy: true,
        timestamp: new Date().toISOString(),
    };
}
