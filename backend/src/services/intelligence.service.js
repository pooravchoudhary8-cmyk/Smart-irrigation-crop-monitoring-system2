import {
    runFullPipeline,
    checkEngineHealth,
    isEngineHealthy,
    logIrrigationEvent,
} from "./aiEngine.service.js";
import { checkIrrigationML } from "./ml.service.js";
import { getRLIrrigationAction } from "./rl.service.js";

/**
 * Intelligence Service
 * ────────────────────
 * Central orchestration layer that:
 *   1. Runs the Intelligence Engine pipeline (FastAPI)      — every 15 s
 *   2. Broadcasts all AI outputs to the frontend via Socket.IO
 *
 * The Intelligence Engine provides 5 modules:
 *   - Irrigation Recommendation (WHEN + HOW MUCH)
 *   - Failure Detection (dead sensors, leaks, motor faults)
 *   - Water Analytics (savings vs flood irrigation)
 *   - Zone Intelligence (virtual moisture map)
 *   - Sensor Calibration
 *
 * Separation of concerns:
 *   - This service DOES NOT contain AI logic — it only orchestrates
 *   - All intelligence lives in the FastAPI engine (port 8001)
 *   - Frontend receives pre-processed, explainable AI output
 */
class IntelligenceService {
    constructor() {
        this.io = null;
        this.lastEngineTime = 0;
        this.engineThrottleMs = 15_000; // 15 s — Intelligence Engine is local, less costly
        this.sensorHistory = []; // Rolling buffer for failure detection
        this.maxHistory = 20;
    }

    /** Inject the Socket.IO instance after server startup */
    init(io) {
        this.io = io;
        console.log("🧠 Intelligence Service initialized:");
        console.log("   └─ AI Intelligence Engine (FastAPI 5-module pipeline)");

        // Perform initial health check on the Intelligence Engine
        checkEngineHealth().then((health) => {
            if (health.healthy) {
                console.log("✅ Intelligence Engine: CONNECTED and healthy");
            } else {
                console.warn(
                    "⚠️  Intelligence Engine: NOT reachable at startup — will retry on next sensor data"
                );
            }
        });
    }

    /**
     * Called every time new MQTT sensor data arrives.
     * Orchestrates the Intelligence Engine pipeline.
     *
     * @param {Object} data - parsed MQTT sensor data from server.js
     * @param {Object} meta - { pumpOn, pumpMode, cropType, cropAgeDays, soilType, cropStage }
     */
    async processSensorData(data, meta = {}) {
        const now = Date.now();

        // Store in rolling history for failure detection
        this.sensorHistory.push({
            sensor_id: "soil_primary",
            moisture: data.soil_moisture ?? 0,
            temperature: data.temperature ?? 0,
            humidity: data.humidity ?? 0,
            timestamp: new Date().toISOString(),
        });
        if (this.sensorHistory.length > this.maxHistory) {
            this.sensorHistory.shift();
        }

        // ── Intelligence Engine Pipeline (throttled to 15s) ─────
        if (now - this.lastEngineTime >= this.engineThrottleMs) {
            this.lastEngineTime = now;
            this._runEnginePipeline(data, meta);
        }
    }

    /**
     * Intelligence Engine Pipeline — FastAPI 5-module AI system
     * Runs irrigation recommendation, failure detection, and water analytics in parallel
     */
    async _runEnginePipeline(data, meta) {
        try {
            console.log(
                "🤖 Intelligence Engine: Running multi-model AI pipeline..."
            );

            // Run ALL major AI models in parallel
            const [result, mlPrediction, rlAction] = await Promise.all([
                // 1. Analytical Intelligence (5-module engine on port 8001)
                runFullPipeline(data, {
                    pumpOn: meta.pumpOn ?? false,
                    irrigationHappened: meta.pumpOn ?? false,
                    crop_type: meta.cropType ?? "Wheat",
                    soil_type: meta.soilType ?? "Loamy",
                    crop_stage: meta.cropStage ?? "vegetative",
                    wind_speed: data.wind_speed ?? 5,
                }),

                // 2. ML Prediction (Random Forest on port 8000)
                checkIrrigationML({
                    moisture: data.soil_moisture,
                    temperature: data.temperature,
                    humidity: data.humidity,
                    crop: meta.cropType || "Wheat",
                    soil_type: meta.soilType || "Loamy",
                    seedling_stage: meta.cropStage || "vegetative",
                }).catch(err => {
                    console.warn("⚠️ ML Prediction warning:", err.message);
                    return null;
                }),

                // 3. RL Optimizer (Deep Reinforcement Learning on port 8000)
                getRLIrrigationAction({
                    ...data,
                    ndvi: data.ndvi ?? 0.5
                }).catch(err => {
                    console.warn("⚠️ RL Action warning:", err.message);
                    return null;
                })
            ]);

            if (!result) {
                console.warn(
                    "⚠️  Intelligence Engine: Pipeline returned null — engine may be offline"
                );

                // Emit health status so frontend knows the engine is down
                if (this.io) {
                    this.io.emit("intelligence-engine-status", {
                        healthy: false,
                        timestamp: new Date().toISOString(),
                    });
                }
                return;
            }

            // ── Log: Irrigation Recommendation ──
            if (result.irrigation) {
                const irr = result.irrigation;
                const emoji = irr.should_irrigate ? "💧" : "✅";
                console.log(
                    `${emoji} [AI] Irrigation: ${irr.urgency} | ${irr.water_needed_liters}L | Runtime: ${irr.sprinkler_runtime_minutes}min`
                );
                console.log(`   └─ "${irr.message}"`);
            }

            // ── Log: Failure Detection ──
            if (result.failures) {
                const fail = result.failures;
                console.log(
                    `🔧 [AI] System Health: ${fail.system_health} (${fail.health_score}/100) | Alerts: ${fail.alerts?.length || 0}`
                );
            }

            // ── Log: Water Analytics ──
            if (result.waterAnalytics) {
                const wa = result.waterAnalytics;
                if (wa.total_irrigations > 0) {
                    console.log(
                        `💧 [AI] Water Savings: ${wa.saving_percent}% | ₹${wa.cost_saved_inr} saved`
                    );
                }
            }

            // ── Broadcast unified intelligence to frontend ──
            if (this.io) {
                this.io.emit("intelligence-engine", {
                    timestamp: result?.timestamp || new Date().toISOString(),
                    engineHealthy: !!result,
                    irrigation: result?.irrigation,
                    failures: result?.failures,
                    waterAnalytics: result?.waterAnalytics,
                    mlPrediction: mlPrediction,
                    rlAction: rlAction,
                });

                // Broadcast specific events for existing listeners if necessary
                if (mlPrediction) this.io.emit("irrigation-prediction", mlPrediction);
                if (rlAction) this.io.emit("rl-action", rlAction);

                this.io.emit("intelligence-engine-status", {
                    healthy: true,
                    timestamp: result.timestamp,
                });
            }

            // ── Auto-log irrigation if pump is running ──
            if (meta.pumpOn && result.irrigation?.water_needed_liters > 0) {
                logIrrigationEvent({
                    zone_id: "default",
                    duration_minutes: result.irrigation.sprinkler_runtime_minutes || 0,
                    liters_used: result.irrigation.water_needed_liters || 0,
                }).catch(() => { });
            }
        } catch (error) {
            console.error("❌ Intelligence Engine Pipeline Error:", error.message);
        }
    }
}

export const intelligenceService = new IntelligenceService();
