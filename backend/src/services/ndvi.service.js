import { fetchNDVI } from "./sentinel.service.js";
import NdviHistory from "../models/ndvi.model.js";
import {
    calculateNDVI,
    classifyNDVI,
    isCacheValid,
} from "../utilities/ndvi.utils.js";

/**
 * NDVI Service Layer
 * ──────────────────
 * Production-ready NDVI integration module.
 *
 * Responsibilities:
 *   1. Check MongoDB cache → return if within satellite revisit window
 *   2. Fetch real-time NDVI from Sentinel Hub if cache is stale
 *   3. Calculate NDVI from raw bands if needed
 *   4. Classify crop health + irrigation recommendation
 *   5. Store results in MongoDB for historical analysis
 *   6. In-memory cache for high-frequency requests (MQTT pipeline)
 *
 * This module NEVER blocks existing irrigation APIs.
 * All external calls are async with timeout + retry.
 */

// ── In-Memory Cache (per farm_id) ────────────────────────────────
// Avoids DB queries for rapid MQTT-triggered calls
const memoryCache = new Map();
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get NDVI data for a farm.
 * This is the main entry point for the NDVI module.
 *
 * Priority:
 *   1. In-memory cache (< 1hr old)
 *   2. MongoDB cache (< satellite revisit window)
 *   3. Fresh fetch from Sentinel Hub
 *   4. Last valid NDVI from DB (if satellite is unavailable)
 *
 * @param {string} farmId - Unique farm identifier
 * @param {number} lat - Farm latitude
 * @param {number} lng - Farm longitude
 * @returns {Promise<Object>} NDVI result with health classification
 */
export async function getNDVIForFarm(farmId, lat, lng) {
    try {
        // ── Step 1: Check in-memory cache ──
        const memCached = memoryCache.get(farmId);
        if (memCached && Date.now() - memCached.timestamp < MEMORY_CACHE_TTL_MS) {
            console.log(`📦 [NDVI] Memory cache HIT for farm ${farmId}`);
            return { ...memCached.data, source: "memory_cache" };
        }

        // ── Step 2: Check MongoDB cache ──
        const dbCached = await NdviHistory.findOne({ farm_id: farmId })
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        if (dbCached && isCacheValid(dbCached.createdAt)) {
            console.log(
                `📦 [NDVI] DB cache HIT for farm ${farmId} (age: ${Math.round(
                    (Date.now() - new Date(dbCached.createdAt).getTime()) / 3600000
                )}h)`
            );

            const result = formatNdviResponse(dbCached);

            // Refresh memory cache
            memoryCache.set(farmId, { data: result, timestamp: Date.now() });

            return { ...result, source: "db_cache" };
        }

        // ── Step 3: Fetch fresh NDVI from Sentinel Hub ──
        console.log(
            `🛰️  [NDVI] Cache MISS for farm ${farmId} — fetching from Sentinel Hub...`
        );

        const sentinelResult = await fetchNDVI(lat, lng);

        if (sentinelResult && sentinelResult.ndvi !== null) {
            const classification = classifyNDVI(sentinelResult.ndvi);

            // Save to MongoDB
            const record = await NdviHistory.create({
                farm_id: farmId,
                coordinates: { lat, lng },
                ndvi_value: sentinelResult.ndvi,
                crop_health_status: classification.status,
                irrigation_recommendation: classification.recommendation,
                irrigation_priority: classification.priority,
                source: "sentinel_hub",
                band_data: {
                    nir: sentinelResult.nir,
                    red: sentinelResult.red,
                },
                raw_response: sentinelResult.stats || null,
            });

            console.log(
                `💾 [NDVI] Saved to DB: farm=${farmId} ndvi=${sentinelResult.ndvi} health=${classification.status}`
            );

            const result = formatNdviResponse(record.toObject());

            // Update memory cache
            memoryCache.set(farmId, { data: result, timestamp: Date.now() });

            return { ...result, source: "sentinel_hub" };
        }

        // ── Step 4: Satellite data unavailable → return last valid ──
        console.warn(
            `⚠️  [NDVI] Sentinel Hub returned no data — falling back to last valid NDVI`
        );

        if (dbCached) {
            const result = formatNdviResponse(dbCached);
            return { ...result, source: "fallback_last_valid", stale: true };
        }

        // No data at all — return a default
        return getDefaultNdviResponse(farmId, lat, lng);
    } catch (error) {
        console.error(`❌ [NDVI] Error for farm ${farmId}:`, error.message);

        // On any error, try to return last valid DB record
        try {
            const lastValid = await NdviHistory.findOne({ farm_id: farmId })
                .sort({ createdAt: -1 })
                .lean()
                .exec();

            if (lastValid) {
                console.log(`🔄 [NDVI] Returning last valid NDVI from DB after error`);
                const result = formatNdviResponse(lastValid);
                return { ...result, source: "error_fallback", stale: true };
            }
        } catch (dbErr) {
            console.error(`❌ [NDVI] DB fallback also failed:`, dbErr.message);
        }

        return getDefaultNdviResponse(farmId, lat, lng);
    }
}

/**
 * Get NDVI history for a farm.
 *
 * @param {string} farmId - Farm identifier
 * @param {number} [limit=30] - Number of records to return
 * @returns {Promise<Object[]>} Array of NDVI history records
 */
export async function getNDVIHistory(farmId, limit = 30) {
    try {
        const records = await NdviHistory.find({ farm_id: farmId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .exec();

        return records.map(formatNdviResponse);
    } catch (error) {
        console.error(`❌ [NDVI] History fetch error:`, error.message);
        return [];
    }
}

/**
 * Compute NDVI from raw sensor bands (NIR + Red).
 * Used when bands are available from local sensors or external source.
 *
 * @param {string} farmId - Farm identifier
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} nir - NIR band value
 * @param {number} red - Red band value
 * @returns {Promise<Object>} NDVI result
 */
export async function computeNDVIFromBands(farmId, lat, lng, nir, red) {
    const ndviValue = calculateNDVI(nir, red);

    if (ndviValue === null) {
        return getDefaultNdviResponse(farmId, lat, lng);
    }

    const classification = classifyNDVI(ndviValue);

    try {
        await NdviHistory.create({
            farm_id: farmId,
            coordinates: { lat, lng },
            ndvi_value: ndviValue,
            crop_health_status: classification.status,
            irrigation_recommendation: classification.recommendation,
            irrigation_priority: classification.priority,
            source: "computed",
            band_data: { nir, red },
        });
    } catch (err) {
        console.warn(`⚠️  [NDVI] DB save failed for computed NDVI:`, err.message);
    }

    return {
        ndvi: ndviValue,
        cropHealthStatus: classification.status,
        irrigationPriority: classification.priority,
        irrigationRecommendation: classification.recommendation,
        lastUpdated: new Date().toISOString(),
        source: "computed",
    };
}

/**
 * Legacy computeNDVI — backward-compatible with existing server.js usage.
 * Uses soil moisture as a proxy when real satellite data isn't available.
 *
 * @param {number} soilMoisture - Soil moisture percentage
 * @param {number|null} red - Red band (optional)
 * @param {number|null} nir - NIR band (optional)
 * @returns {Promise<Object>} NDVI-like result
 */
export async function computeNDVI(soilMoisture, red = null, nir = null) {
    try {
        // If real bands are provided, compute real NDVI
        if (nir !== null && red !== null) {
            const ndviValue = calculateNDVI(nir, red);
            const classification = classifyNDVI(ndviValue);
            return {
                score: ndviValue,
                health_status: classification.status,
                confidence: 0.95,
                priority: classification.priority,
                recommendation: classification.recommendation,
            };
        }

        // Proxy NDVI from soil moisture (heuristic for when satellite data is unavailable)
        // This is a rough approximation — real NDVI should come from Sentinel Hub
        let proxyNdvi;
        if (soilMoisture >= 60) proxyNdvi = 0.65 + Math.random() * 0.15;
        else if (soilMoisture >= 30) proxyNdvi = 0.35 + Math.random() * 0.2;
        else proxyNdvi = 0.1 + Math.random() * 0.15;

        proxyNdvi = parseFloat(proxyNdvi.toFixed(4));
        const classification = classifyNDVI(proxyNdvi);

        return {
            score: proxyNdvi,
            health_status: classification.status,
            confidence: 0.6, // Lower confidence for proxy
            priority: classification.priority,
            recommendation: classification.recommendation,
            note: "Estimated from soil moisture (satellite data not used)",
        };
    } catch (error) {
        console.error("❌ [NDVI] computeNDVI error:", error.message);
        return null;
    }
}

// ── Internal Helpers ─────────────────────────────────────────────

function formatNdviResponse(record) {
    return {
        farmId: record.farm_id,
        ndvi: record.ndvi_value,
        cropHealthStatus: record.crop_health_status,
        irrigationPriority: record.irrigation_priority,
        irrigationRecommendation: record.irrigation_recommendation,
        coordinates: record.coordinates,
        lastUpdated: record.createdAt || record.updatedAt,
        bandData: record.band_data || null,
    };
}

function getDefaultNdviResponse(farmId, lat, lng) {
    return {
        farmId,
        ndvi: null,
        cropHealthStatus: "Unknown",
        irrigationPriority: "NORMAL",
        irrigationRecommendation:
            "NDVI data unavailable. Maintaining normal irrigation schedule. " +
            "Satellite data may be temporarily unavailable due to cloud cover or service downtime.",
        coordinates: { lat, lng },
        lastUpdated: new Date().toISOString(),
        source: "no_data",
    };
}

/**
 * Clear in-memory cache for a farm (useful after manual override).
 * @param {string} farmId
 */
export function clearNDVICache(farmId) {
    memoryCache.delete(farmId);
    console.log(`🗑️  [NDVI] Memory cache cleared for farm ${farmId}`);
}
