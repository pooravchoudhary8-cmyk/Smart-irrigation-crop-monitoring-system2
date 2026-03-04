import {
    getNDVIForFarm,
    getNDVIHistory,
    computeNDVIFromBands,
    clearNDVICache,
} from "../services/ndvi.service.js";

/**
 * NDVI Controller
 * ───────────────
 * Handles HTTP requests for NDVI data.
 * All business logic lives in the service layer.
 */

/**
 * GET /api/ndvi/:farm_id
 *
 * Fetch latest NDVI for a farm.
 * Query params: lat, lng (required for first-time / cache-miss)
 *
 * Response:
 *   { ndvi, cropHealthStatus, lastUpdated, irrigationRecommendation, ... }
 */
export async function getFarmNDVI(req, res) {
    try {
        const { farm_id } = req.params;
        const { lat, lng } = req.query;

        if (!farm_id) {
            return res.status(400).json({ error: "farm_id is required" });
        }

        // Default coordinates if not provided (can be fetched from farm profile later)
        const latitude = parseFloat(lat) || 28.6139; // Default: New Delhi
        const longitude = parseFloat(lng) || 77.209;

        console.log(
            `📡 [NDVI API] GET /api/ndvi/${farm_id} | coords: (${latitude}, ${longitude})`
        );

        const result = await getNDVIForFarm(farm_id, latitude, longitude);

        res.json({
            success: true,
            data: {
                ndvi: result.ndvi,
                cropHealthStatus: result.cropHealthStatus,
                lastUpdated: result.lastUpdated,
                irrigationRecommendation: result.irrigationRecommendation,
                irrigationPriority: result.irrigationPriority,
                coordinates: result.coordinates,
                source: result.source,
                stale: result.stale || false,
            },
        });
    } catch (error) {
        console.error("❌ [NDVI API] Error:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to fetch NDVI data",
            message: error.message,
        });
    }
}

/**
 * GET /api/ndvi/:farm_id/history
 *
 * Fetch NDVI history for a farm.
 * Query params: limit (optional, default 30)
 */
export async function getFarmNDVIHistory(req, res) {
    try {
        const { farm_id } = req.params;
        const limit = parseInt(req.query.limit) || 30;

        if (!farm_id) {
            return res.status(400).json({ error: "farm_id is required" });
        }

        const history = await getNDVIHistory(farm_id, limit);

        res.json({
            success: true,
            count: history.length,
            data: history,
        });
    } catch (error) {
        console.error("❌ [NDVI API] History error:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to fetch NDVI history",
        });
    }
}

/**
 * POST /api/ndvi/compute
 *
 * Compute NDVI from raw NIR and Red band values.
 * Body: { farm_id, lat, lng, nir, red }
 */
export async function computeNDVI(req, res) {
    try {
        const { farm_id, lat, lng, nir, red } = req.body;

        if (!farm_id || nir === undefined || red === undefined) {
            return res.status(400).json({
                error: "farm_id, nir, and red are required",
            });
        }

        const result = await computeNDVIFromBands(
            farm_id,
            parseFloat(lat) || 0,
            parseFloat(lng) || 0,
            parseFloat(nir),
            parseFloat(red)
        );

        res.json({ success: true, data: result });
    } catch (error) {
        console.error("❌ [NDVI API] Compute error:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to compute NDVI",
        });
    }
}

/**
 * POST /api/ndvi/:farm_id/refresh
 *
 * Force-refresh NDVI data (clears cache and fetches fresh from Sentinel Hub).
 */
export async function refreshFarmNDVI(req, res) {
    try {
        const { farm_id } = req.params;
        const { lat, lng } = req.body;

        if (!farm_id) {
            return res.status(400).json({ error: "farm_id is required" });
        }

        // Clear caches
        clearNDVICache(farm_id);

        const latitude = parseFloat(lat) || 28.6139;
        const longitude = parseFloat(lng) || 77.209;

        console.log(`🔄 [NDVI API] Force refresh for farm ${farm_id}`);

        const result = await getNDVIForFarm(farm_id, latitude, longitude);

        res.json({
            success: true,
            message: "NDVI data refreshed",
            data: {
                ndvi: result.ndvi,
                cropHealthStatus: result.cropHealthStatus,
                lastUpdated: result.lastUpdated,
                irrigationRecommendation: result.irrigationRecommendation,
                irrigationPriority: result.irrigationPriority,
                source: result.source,
            },
        });
    } catch (error) {
        console.error("❌ [NDVI API] Refresh error:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to refresh NDVI data",
        });
    }
}
