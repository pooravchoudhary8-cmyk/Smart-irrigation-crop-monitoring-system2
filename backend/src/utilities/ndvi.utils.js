/**
 * NDVI Utility Functions
 * ──────────────────────
 * Pure utility functions for NDVI calculation and classification.
 * No external dependencies — easily testable.
 */

/**
 * Calculate NDVI from NIR and Red band reflectance values.
 * Formula: NDVI = (NIR - Red) / (NIR + Red)
 *
 * @param {number} nir - Near-Infrared band reflectance (0 to 1)
 * @param {number} red - Red band reflectance (0 to 1)
 * @returns {number} NDVI value between -1 and 1
 */
export function calculateNDVI(nir, red) {
    if (nir === null || red === null || nir === undefined || red === undefined) {
        return null;
    }
    const denominator = nir + red;
    if (denominator === 0) return 0;
    return parseFloat(((nir - red) / denominator).toFixed(4));
}

/**
 * Classify crop health based on NDVI value.
 *
 * @param {number} ndvi - NDVI value (-1 to 1)
 * @returns {{ status: string, priority: string, recommendation: string }}
 */
export function classifyNDVI(ndvi) {
    if (ndvi === null || ndvi === undefined || isNaN(ndvi)) {
        return {
            status: "Unknown",
            priority: "NORMAL",
            recommendation: "Unable to determine — NDVI data unavailable.",
        };
    }

    if (ndvi < 0.3) {
        return {
            status: "Poor",
            priority: "HIGH",
            recommendation:
                "⚠️ Crop health is poor. Increase irrigation priority immediately. " +
                "Check for nutrient deficiency, water stress, or pest damage. " +
                "Consider soil testing and foliar spray application.",
        };
    }

    if (ndvi <= 0.6) {
        return {
            status: "Moderate",
            priority: "NORMAL",
            recommendation:
                "✅ Crop health is moderate. Maintain normal irrigation schedule. " +
                "Continue monitoring — slight adjustments may be needed " +
                "based on weather forecast and growth stage.",
        };
    }

    return {
        status: "Healthy",
        priority: "LOW",
        recommendation:
            "🌿 Crop health is excellent. Delay irrigation to save water. " +
            "Vegetation is thriving — reduce water usage by 20-30% " +
            "to optimize resource consumption without affecting yield.",
    };
}

/**
 * Sentinel-2 revisit window in milliseconds.
 * Sentinel-2A + 2B combined revisit: ~5 days.
 * We use 4 days to ensure freshness.
 */
export const SATELLITE_REVISIT_WINDOW_MS = 4 * 24 * 60 * 60 * 1000; // 4 days

/**
 * Check if a cached NDVI record is still valid (within satellite revisit window).
 *
 * @param {Date} cachedTimestamp - When the NDVI was last fetched
 * @returns {boolean} true if still valid
 */
export function isCacheValid(cachedTimestamp) {
    if (!cachedTimestamp) return false;
    const age = Date.now() - new Date(cachedTimestamp).getTime();
    return age < SATELLITE_REVISIT_WINDOW_MS;
}
