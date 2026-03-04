import {
    getIntelligenceReport,
    getCropConfig,
    updateCropConfig,
    logIrrigation,
} from "../services/fusionEngine.service.js";

/**
 * Intelligence Engine Controller
 * ──────────────────────────────
 * HTTP handlers for the Data Fusion Intelligence Engine.
 */

/**
 * GET /api/intelligence/:farm_id
 *
 * Primary endpoint — returns the full intelligence report.
 *
 * Response:
 * {
 *   irrigationDecision,
 *   cropStressRisk,
 *   nextIrrigationTimer,
 *   systemHealth,
 *   waterSavingPotential,
 *   ndviInsights,
 *   fieldSnapshot
 * }
 */
export async function getIntelligence(req, res) {
    try {
        const { farm_id } = req.params;

        if (!farm_id) {
            return res.status(400).json({ error: "farm_id is required" });
        }

        console.log(`🧠 [ENGINE API] GET /api/intelligence/${farm_id}`);

        const report = await getIntelligenceReport(farm_id);

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error("❌ [ENGINE API] Error:", error.message);
        res.status(500).json({
            success: false,
            error: "Intelligence Engine failed",
            message: error.message,
        });
    }
}

/**
 * POST /api/intelligence/:farm_id/decide
 *
 * Generate decision using live sensor data provided in body.
 * Used when real-time override is needed (e.g., frontend passes current readings).
 */
export async function getDecisionWithData(req, res) {
    try {
        const { farm_id } = req.params;
        const sensorData = req.body;

        if (!farm_id) {
            return res.status(400).json({ error: "farm_id is required" });
        }

        const report = await getIntelligenceReport(farm_id, sensorData);

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error("❌ [ENGINE API] Decision error:", error.message);
        res.status(500).json({
            success: false,
            error: "Decision generation failed",
        });
    }
}

/**
 * GET /api/intelligence/:farm_id/config
 *
 * Get crop configuration for a farm.
 */
export async function getFarmConfig(req, res) {
    try {
        const { farm_id } = req.params;
        const config = await getCropConfig(farm_id);

        res.json({ success: true, data: config });
    } catch (error) {
        console.error("❌ [ENGINE API] Config error:", error.message);
        res.status(500).json({ success: false, error: "Failed to get config" });
    }
}

/**
 * PUT /api/intelligence/:farm_id/config
 *
 * Update crop configuration (crop type, growth stage, thresholds, etc.)
 */
export async function setFarmConfig(req, res) {
    try {
        const { farm_id } = req.params;
        const updates = req.body;

        if (!farm_id) {
            return res.status(400).json({ error: "farm_id is required" });
        }

        const config = await updateCropConfig(farm_id, updates);

        res.json({
            success: true,
            message: "Configuration updated",
            data: config,
        });
    } catch (error) {
        console.error("❌ [ENGINE API] Config update error:", error.message);
        res.status(500).json({ success: false, error: "Failed to update config" });
    }
}

/**
 * POST /api/intelligence/:farm_id/log-irrigation
 *
 * Log an irrigation event for analytics tracking.
 */
export async function logIrrigationEvent(req, res) {
    try {
        const { farm_id } = req.params;
        const event = req.body;

        const record = await logIrrigation(farm_id, event);

        res.json({
            success: true,
            message: "Irrigation event logged",
            data: record,
        });
    } catch (error) {
        console.error("❌ [ENGINE API] Log error:", error.message);
        res.status(500).json({ success: false, error: "Failed to log irrigation" });
    }
}
