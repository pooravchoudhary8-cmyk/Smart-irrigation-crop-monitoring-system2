import Sensor from "../models/sensor.model.js";
import NdviHistory from "../models/ndvi.model.js";
import CropConfig from "../models/cropConfig.model.js";
import IrrigationHistory from "../models/irrigationHistory.model.js";
import {
    calculateCropStressRisk,
    generateIrrigationDecision,
    detectAnomalies,
    calculateWaterSavings,
    estimateDryingTime,
    computeIrrigationTime,
} from "../utilities/intelligence.utils.js";

/**
 * Data Fusion Intelligence Engine
 * ────────────────────────────────
 * Fuses multi-source agricultural data and generates
 * real-time irrigation decisions and crop advisory.
 *
 * Architecture:
 *   1. DATA FUSION LAYER → Builds unified field state from 4 collections
 *   2. DECISION ENGINE   → Rule-based + NDVI-validated irrigation logic
 *   3. RISK ASSESSMENT   → Crop stress risk scoring
 *   4. ANOMALY DETECTION → Hardware and environmental alerts
 *   5. WATER ANALYTICS   → Savings vs flood irrigation
 *
 * Design:
 *   - Stateless service (horizontally scalable)
 *   - Caches last decision per farm (avoids recompute)
 *   - Async/non-blocking — never blocks existing APIs
 *   - Multi-farm support
 */

// ── Decision Cache (per farm) ────────────────────────────────────
const decisionCache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

// ── Sensor History Buffer (for anomaly detection) ────────────────
const sensorHistoryBuffers = new Map();
const MAX_HISTORY = 20;

/**
 * Main Entry: Get full intelligence report for a farm.
 *
 * @param {string} farmId - Farm identifier
 * @param {Object} [liveSensorData] - Optional real-time sensor override
 * @returns {Promise<Object>} Complete intelligence report
 */
export async function getIntelligenceReport(farmId, liveSensorData = null) {
    try {
        // ── Check Cache ──
        const cached = decisionCache.get(farmId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && !liveSensorData) {
            console.log(`📦 [ENGINE] Cache HIT for farm ${farmId}`);
            return { ...cached.data, source: "cache" };
        }

        console.log(`🧠 [ENGINE] Computing intelligence report for farm ${farmId}...`);

        // ── Step 1: Data Fusion — Build Unified Field State ──
        const fieldState = await buildFieldState(farmId, liveSensorData);

        // ── Step 2: Decision Engine ──
        const irrigationDecision = generateIrrigationDecision(fieldState);

        // ── Step 3: Crop Stress Risk ──
        const cropStressRisk = calculateCropStressRisk(fieldState);

        // ── Step 4: Anomaly Detection ──
        const sensorHistory = sensorHistoryBuffers.get(farmId) || [];
        const anomalyAlerts = detectAnomalies(fieldState, sensorHistory);

        // ── Step 5: Drying Prediction ──
        const { min: thresholdMin } = getStageThresholds(fieldState.growth_stage, fieldState.thresholds);
        const hoursUntilDry = estimateDryingTime(
            fieldState.soil_moisture,
            thresholdMin,
            fieldState.temperature,
            fieldState.humidity
        );

        // ── Step 6: Irrigation Time Calculation ──
        const irrigationTimeMins = computeIrrigationTime(
            irrigationDecision.waterQuantityLiters,
            fieldState.sprinkler_flow_rate
        );

        // ── Step 7: Water Savings ──
        const irrigationStats = await getIrrigationStats(farmId);
        const waterSavings = calculateWaterSavings(fieldState, irrigationStats);

        // ── Step 8: NDVI Trend Analysis ──
        const ndviTrend = await getNDVITrend(farmId);

        // ── Compose Final Report ──
        const report = {
            farmId,
            timestamp: new Date().toISOString(),

            // 🧠 Core Decision
            irrigationDecision: {
                action: irrigationDecision.action,
                priority: irrigationDecision.priority,
                waterQuantityLiters: irrigationDecision.waterQuantityLiters,
                irrigationTimeMinutes: irrigationTimeMins,
                reason: irrigationDecision.reason,
                delayHours: irrigationDecision.delayHours,
            },

            // 📊 Crop Stress
            cropStressRisk: {
                score: cropStressRisk,
                level:
                    cropStressRisk > 70
                        ? "CRITICAL"
                        : cropStressRisk > 40
                            ? "MODERATE"
                            : "LOW",
                description: getCropStressDescription(cropStressRisk),
            },

            // ⏳ Next Irrigation Timer
            nextIrrigationTimer: {
                hoursUntilNeeded: hoursUntilDry,
                estimatedTime: new Date(
                    Date.now() + hoursUntilDry * 3600000
                ).toISOString(),
            },

            // ⚠️ System Health & Alerts
            systemHealth: {
                alertCount: anomalyAlerts.length,
                alerts: anomalyAlerts,
                overallStatus:
                    anomalyAlerts.filter((a) => a.severity === "high").length > 0
                        ? "WARNING"
                        : anomalyAlerts.length > 0
                            ? "MONITOR"
                            : "HEALTHY",
            },

            // 📉 Water Saving
            waterSavingPotential: waterSavings,

            // 🛰️ NDVI Insights
            ndviInsights: {
                currentNDVI: fieldState.ndvi,
                trend: ndviTrend.trend,
                trendDescription: ndviTrend.description,
            },

            // 🌱 Field State Snapshot (for debugging/transparency)
            fieldSnapshot: {
                soilMoisture: fieldState.soil_moisture,
                temperature: fieldState.temperature,
                humidity: fieldState.humidity,
                rainDetected: fieldState.rain_detected,
                ndvi: fieldState.ndvi,
                cropType: fieldState.crop_type,
                growthStage: fieldState.growth_stage,
                pumpOn: fieldState.pump_on,
            },
        };

        // ── Cache the report ──
        decisionCache.set(farmId, { data: report, timestamp: Date.now() });

        console.log(
            `✅ [ENGINE] Report: action=${report.irrigationDecision.action} ` +
            `stress=${cropStressRisk}/100 alerts=${anomalyAlerts.length}`
        );

        return { ...report, source: "computed" };
    } catch (error) {
        console.error(`❌ [ENGINE] Error for farm ${farmId}:`, error.message);

        // Return cached if available on error
        const fallback = decisionCache.get(farmId);
        if (fallback) {
            return { ...fallback.data, source: "error_fallback", stale: true };
        }

        return getDefaultReport(farmId);
    }
}

/**
 * Process incoming sensor data (called from MQTT pipeline).
 * Updates the sensor history buffer for anomaly detection.
 *
 * @param {string} farmId
 * @param {Object} sensorData
 * @param {Object} meta - { pumpOn, pumpMode }
 */
export function ingestSensorData(farmId, sensorData, meta = {}) {
    // Update history buffer
    let history = sensorHistoryBuffers.get(farmId) || [];
    history.push({
        ...sensorData,
        pump_on: meta.pumpOn || false,
        timestamp: new Date().toISOString(),
    });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    sensorHistoryBuffers.set(farmId, history);

    // Invalidate cache so next report recomputes
    decisionCache.delete(farmId);
}

/**
 * Get or create crop config for a farm.
 */
export async function getCropConfig(farmId) {
    try {
        let config = await CropConfig.findOne({ farm_id: farmId }).lean().exec();
        if (!config) {
            // Create default config
            config = await CropConfig.create({
                farm_id: farmId,
                crop_type: "Wheat",
                soil_type: "Loamy",
                growth_stage: "vegetative",
            });
            config = config.toObject();
        }
        return config;
    } catch (err) {
        console.warn(`⚠️ [ENGINE] Could not fetch crop config:`, err.message);
        return {
            farm_id: farmId,
            crop_type: "Wheat",
            soil_type: "Loamy",
            growth_stage: "vegetative",
            thresholds: null,
            coordinates: { lat: 28.6139, lng: 77.209 },
            field_area_sqm: 1000,
            sprinkler_flow_rate_lpm: 15,
        };
    }
}

/**
 * Update crop config for a farm.
 */
export async function updateCropConfig(farmId, updates) {
    try {
        const config = await CropConfig.findOneAndUpdate(
            { farm_id: farmId },
            { $set: updates },
            { new: true, upsert: true }
        )
            .lean()
            .exec();

        // Invalidate decision cache
        decisionCache.delete(farmId);

        return config;
    } catch (err) {
        console.error(`❌ [ENGINE] Config update error:`, err.message);
        throw err;
    }
}

/**
 * Log an irrigation event.
 */
export async function logIrrigation(farmId, event) {
    try {
        return await IrrigationHistory.create({
            farm_id: farmId,
            ...event,
        });
    } catch (err) {
        console.warn(`⚠️ [ENGINE] Could not log irrigation:`, err.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
//  INTERNAL — DATA FUSION LAYER
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a unified field state object by fusing all data sources.
 */
async function buildFieldState(farmId, liveSensorData = null) {
    // Fetch in parallel for performance
    const [cropConfig, latestNDVI, latestSensor] = await Promise.all([
        getCropConfig(farmId),
        getLatestNDVI(farmId),
        liveSensorData ? null : getLatestSensor(),
    ]);

    const sensor = liveSensorData || latestSensor || {};
    const sensorHistory = sensorHistoryBuffers.get(farmId) || [];
    const latestHistoryEntry = sensorHistory[sensorHistory.length - 1] || {};

    return {
        farm_id: farmId,
        soil_moisture: sensor.soil_moisture ?? latestHistoryEntry.soil_moisture ?? 50,
        temperature: sensor.temperature ?? latestHistoryEntry.temperature ?? 28,
        humidity: sensor.humidity ?? latestHistoryEntry.humidity ?? 60,
        rain_detected: sensor.rain_detected ?? false,
        rain_forecast: false, // Can be integrated with weather API later
        ndvi: latestNDVI?.ndvi_value ?? 0.5,
        crop_type: cropConfig.crop_type || "Wheat",
        soil_type: cropConfig.soil_type || "Loamy",
        growth_stage: cropConfig.growth_stage || "vegetative",
        thresholds: cropConfig.thresholds || null,
        pump_on: latestHistoryEntry.pump_on ?? false,
        field_area_sqm: cropConfig.field_area_sqm || 1000,
        sprinkler_flow_rate: cropConfig.sprinkler_flow_rate_lpm || 15,
        last_irrigation_hours: 24, // Default, can be computed from history
        coordinates: cropConfig.coordinates || { lat: 28.6139, lng: 77.209 },
    };
}

async function getLatestSensor() {
    try {
        return await Sensor.findOne().sort({ createdAt: -1 }).lean().exec();
    } catch {
        return null;
    }
}

async function getLatestNDVI(farmId) {
    try {
        return await NdviHistory.findOne({ farm_id: farmId })
            .sort({ createdAt: -1 })
            .lean()
            .exec();
    } catch {
        return null;
    }
}

async function getIrrigationStats(farmId) {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const records = await IrrigationHistory.find({
            farm_id: farmId,
            createdAt: { $gte: sevenDaysAgo },
        })
            .lean()
            .exec();

        const totalLitersUsed = records.reduce(
            (sum, r) => sum + (r.liters_used || 0),
            0
        );

        return {
            totalLitersUsed,
            irrigationCount: records.length,
            daysPeriod: 7,
        };
    } catch {
        return { totalLitersUsed: 0, irrigationCount: 0, daysPeriod: 7 };
    }
}

async function getNDVITrend(farmId) {
    try {
        const records = await NdviHistory.find({ farm_id: farmId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean()
            .exec();

        if (records.length < 2) {
            return { trend: "stable", description: "Not enough data for trend analysis." };
        }

        const latest = records[0].ndvi_value;
        const previous = records[records.length - 1].ndvi_value;
        const change = latest - previous;

        if (change > 0.05) {
            return { trend: "improving", description: `NDVI improving (+${change.toFixed(3)}). Crop health trending positive.` };
        } else if (change < -0.05) {
            return { trend: "declining", description: `NDVI declining (${change.toFixed(3)}). Monitor for stress factors.` };
        }
        return { trend: "stable", description: "NDVI stable. Crop health consistent." };
    } catch {
        return { trend: "unknown", description: "Unable to compute NDVI trend." };
    }
}

function getStageThresholds(stage, customThresholds) {
    const defaults = {
        germination: { min: 60, max: 80, critical_low: 50 },
        seedling: { min: 55, max: 75, critical_low: 45 },
        vegetative: { min: 45, max: 70, critical_low: 35 },
        flowering: { min: 50, max: 75, critical_low: 40 },
        fruiting: { min: 45, max: 70, critical_low: 35 },
        maturity: { min: 35, max: 60, critical_low: 25 },
        harvest: { min: 20, max: 45, critical_low: 15 },
    };
    const thresholds = customThresholds || defaults;
    return thresholds[stage] || thresholds.vegetative;
}

function getCropStressDescription(score) {
    if (score > 70)
        return "Severe crop stress detected. Immediate attention required — check irrigation, nutrients, and pest damage.";
    if (score > 40)
        return "Moderate crop stress. Adjustments recommended — review irrigation schedule and environmental conditions.";
    if (score > 20)
        return "Mild stress indicators present. Continue monitoring.";
    return "Crop health is excellent. All parameters within optimal range.";
}

function getDefaultReport(farmId) {
    return {
        farmId,
        timestamp: new Date().toISOString(),
        irrigationDecision: {
            action: "DELAY",
            priority: "NORMAL",
            waterQuantityLiters: 0,
            irrigationTimeMinutes: 0,
            reason: "Intelligence Engine initializing — using default schedule.",
            delayHours: 1,
        },
        cropStressRisk: {
            score: 0,
            level: "LOW",
            description: "No data available. Using default assessment.",
        },
        nextIrrigationTimer: {
            hoursUntilNeeded: 1,
            estimatedTime: new Date(Date.now() + 3600000).toISOString(),
        },
        systemHealth: {
            alertCount: 0,
            alerts: [],
            overallStatus: "INITIALIZING",
        },
        waterSavingPotential: {
            savingPercent: 0,
            efficiencyRating: "Initializing",
        },
        ndviInsights: {
            currentNDVI: null,
            trend: "unknown",
            trendDescription: "No data yet.",
        },
        fieldSnapshot: {},
        source: "default",
    };
}
