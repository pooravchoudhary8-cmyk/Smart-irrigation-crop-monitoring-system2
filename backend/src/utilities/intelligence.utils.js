/**
 * Intelligence Engine Utilities
 * ─────────────────────────────
 * Pure functions for crop stress, anomaly detection, irrigation logic,
 * water saving estimation, and drying-rate prediction.
 *
 * Zero external dependencies — testable in isolation.
 */

// ─── Default Crop-Stage Thresholds ─────────────────────────────────
const DEFAULT_THRESHOLDS = {
    germination: { min: 60, max: 80, critical_low: 50 },
    seedling: { min: 55, max: 75, critical_low: 45 },
    vegetative: { min: 45, max: 70, critical_low: 35 },
    flowering: { min: 50, max: 75, critical_low: 40 },
    fruiting: { min: 45, max: 70, critical_low: 35 },
    maturity: { min: 35, max: 60, critical_low: 25 },
    harvest: { min: 20, max: 45, critical_low: 15 },
};

/**
 * Get moisture thresholds for a specific crop growth stage.
 */
export function getThresholds(stage, customThresholds = null) {
    const thresholds = customThresholds || DEFAULT_THRESHOLDS;
    return thresholds[stage] || thresholds.vegetative;
}

// ═══════════════════════════════════════════════════════════════════
//  CROP STRESS RISK SCORE (0-100)
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate crop stress risk score from fused data sources.
 *
 * Components:
 *   - Moisture deficit stress (40% weight)
 *   - Temperature stress (20% weight)
 *   - NDVI-based vegetation stress (25% weight)
 *   - Humidity stress (15% weight)
 *
 * @param {Object} fieldState - Unified field state object
 * @returns {number} Risk score 0-100 (higher = more stress)
 */
export function calculateCropStressRisk(fieldState) {
    const {
        soil_moisture = 50,
        temperature = 28,
        humidity = 60,
        ndvi = 0.5,
        growth_stage = "vegetative",
        thresholds: customThresholds,
    } = fieldState;

    const thresholds = getThresholds(growth_stage, customThresholds);

    // 1. Moisture Deficit Stress (0-100, weight 40%)
    let moistureStress = 0;
    if (soil_moisture < thresholds.critical_low) {
        moistureStress = 100;
    } else if (soil_moisture < thresholds.min) {
        moistureStress = 50 + ((thresholds.min - soil_moisture) / (thresholds.min - thresholds.critical_low)) * 50;
    } else if (soil_moisture > thresholds.max) {
        moistureStress = Math.min(40, ((soil_moisture - thresholds.max) / 20) * 40); // Over-watering stress
    }

    // 2. Temperature Stress (0-100, weight 20%)
    let tempStress = 0;
    if (temperature > 42) tempStress = 100;
    else if (temperature > 38) tempStress = 60 + ((temperature - 38) / 4) * 40;
    else if (temperature > 35) tempStress = 30 + ((temperature - 35) / 3) * 30;
    else if (temperature < 5) tempStress = 80;
    else if (temperature < 10) tempStress = 30;

    // 3. NDVI Vegetation Stress (0-100, weight 25%)
    let ndviStress = 0;
    if (ndvi < 0.2) ndviStress = 100;
    else if (ndvi < 0.3) ndviStress = 60 + ((0.3 - ndvi) / 0.1) * 40;
    else if (ndvi < 0.5) ndviStress = 20 + ((0.5 - ndvi) / 0.2) * 40;
    else if (ndvi > 0.7) ndviStress = 0; // Healthy
    else ndviStress = Math.max(0, (0.7 - ndvi) / 0.2 * 20);

    // 4. Humidity Stress (0-100, weight 15%)
    let humidityStress = 0;
    if (humidity < 20) humidityStress = 80;
    else if (humidity < 30) humidityStress = 40;
    else if (humidity > 90) humidityStress = 30; // High humidity = disease risk

    // Weighted combination
    const riskScore =
        moistureStress * 0.4 +
        tempStress * 0.2 +
        ndviStress * 0.25 +
        humidityStress * 0.15;

    return Math.round(Math.min(100, Math.max(0, riskScore)));
}

// ═══════════════════════════════════════════════════════════════════
//  IRRIGATION DECISION ENGINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate irrigation decision from fused field state.
 *
 * @param {Object} fieldState - Unified field state
 * @returns {{ action, priority, waterQuantityLiters, reason, delayHours }}
 */
export function generateIrrigationDecision(fieldState) {
    const {
        soil_moisture = 50,
        temperature = 28,
        humidity = 60,
        rain_detected = false,
        rain_forecast = false,
        ndvi = 0.5,
        growth_stage = "vegetative",
        pump_on = false,
        field_area_sqm = 1000,
        sprinkler_flow_rate = 15,
        last_irrigation_hours = 24,
        thresholds: customThresholds,
    } = fieldState;

    const thresholds = getThresholds(growth_stage, customThresholds);
    let action = "DELAY";
    let priority = "LOW";
    let reason = "";
    let delayHours = 0;
    let waterQuantityLiters = 0;

    // ── Rule 1: Rain Override ──
    if (rain_detected) {
        action = "STOP";
        priority = "LOW";
        reason = "Rain detected — irrigation not needed.";
        return { action, priority, waterQuantityLiters: 0, reason, delayHours: 6 };
    }

    if (rain_forecast) {
        action = "DELAY";
        priority = "LOW";
        reason = "Rain forecast — delaying irrigation to save water.";
        return { action, priority, waterQuantityLiters: 0, reason, delayHours: 4 };
    }

    // ── Rule 2: Critical Low Moisture ──
    if (soil_moisture < thresholds.critical_low) {
        action = "START";
        priority = "HIGH";
        const deficit = thresholds.min - soil_moisture;
        waterQuantityLiters = Math.round(
            (deficit / 100) * field_area_sqm * 0.6 // 0.6 L/sqm/% deficit
        );
        reason = `Critical moisture deficit (${soil_moisture}% < ${thresholds.critical_low}% critical threshold for ${growth_stage}). Immediate irrigation required.`;
        return { action, priority, waterQuantityLiters, reason, delayHours: 0 };
    }

    // ── Rule 3: Below Minimum Threshold ──
    if (soil_moisture < thresholds.min) {
        // Cross-validate with NDVI
        if (ndvi < 0.4) {
            action = "START";
            priority = "HIGH";
            reason = `Soil moisture below threshold AND NDVI poor (${ndvi.toFixed(2)}). Vegetation stress confirmed by satellite data.`;
        } else {
            action = "START";
            priority = "MEDIUM";
            reason = `Soil moisture below optimal (${soil_moisture}% < ${thresholds.min}%). NDVI acceptable (${ndvi.toFixed(2)}) — moderate priority.`;
        }

        const deficit = thresholds.min - soil_moisture;
        waterQuantityLiters = Math.round(
            (deficit / 100) * field_area_sqm * 0.5
        );
        return { action, priority, waterQuantityLiters, reason, delayHours: 0 };
    }

    // ── Rule 4: Within Optimal Range ──
    if (soil_moisture >= thresholds.min && soil_moisture <= thresholds.max) {
        // Check if NDVI suggests vegetation is struggling despite OK moisture
        if (ndvi < 0.3) {
            action = "DELAY";
            priority = "MEDIUM";
            reason = `Moisture OK (${soil_moisture}%) but NDVI poor (${ndvi.toFixed(2)}). Possible nutrient deficiency — investigate before irrigating.`;
            delayHours = 2;
        } else {
            action = "DELAY";
            priority = "LOW";
            const hoursUntilDry = estimateDryingTime(
                soil_moisture,
                thresholds.min,
                temperature,
                humidity
            );
            delayHours = Math.round(hoursUntilDry);
            reason = `Moisture adequate (${soil_moisture}%). Next irrigation needed in ~${delayHours}h.`;
        }
        return { action, priority, waterQuantityLiters: 0, reason, delayHours };
    }

    // ── Rule 5: Above Maximum (over-watered) ──
    action = "STOP";
    priority = "LOW";
    reason = `Soil moisture above maximum (${soil_moisture}% > ${thresholds.max}%). Stop irrigation to prevent waterlogging.`;
    return { action, priority, waterQuantityLiters: 0, reason, delayHours: 8 };
}

// ═══════════════════════════════════════════════════════════════════
//  ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect anomalies from field state and sensor history.
 *
 * @param {Object} fieldState - Current field state
 * @param {Object[]} sensorHistory - Last N sensor readings
 * @returns {Object[]} Array of anomaly alerts
 */
export function detectAnomalies(fieldState, sensorHistory = []) {
    const alerts = [];
    const { soil_moisture, temperature, humidity, pump_on, ndvi } = fieldState;

    // 1. Pump ON but moisture not increasing
    if (pump_on && sensorHistory.length >= 3) {
        const recent = sensorHistory.slice(-3);
        const moistureChange =
            recent[recent.length - 1].soil_moisture - recent[0].soil_moisture;

        if (moistureChange < 2) {
            alerts.push({
                type: "PUMP_ANOMALY",
                severity: "high",
                message:
                    "Motor is ON but soil moisture not increasing. Possible pipe leak, pump malfunction, or sensor failure.",
                timestamp: new Date().toISOString(),
            });
        }
    }

    // 2. Sensor reading anomalies
    if (temperature === 0 && humidity === 0) {
        alerts.push({
            type: "SENSOR_FAILURE",
            severity: "medium",
            message: "Temperature and humidity both 0 — possible DHT sensor failure or power glitch.",
            timestamp: new Date().toISOString(),
        });
    }

    if (soil_moisture > 95) {
        alerts.push({
            type: "WATERLOGGING",
            severity: "high",
            message: `Soil moisture critically high (${soil_moisture}%). Risk of waterlogging and root rot.`,
            timestamp: new Date().toISOString(),
        });
    }

    // 3. NDVI vs moisture conflict
    if (ndvi !== null && ndvi !== undefined) {
        if (soil_moisture > 60 && ndvi < 0.25) {
            alerts.push({
                type: "NDVI_MOISTURE_CONFLICT",
                severity: "medium",
                message: `High moisture (${soil_moisture}%) but very low NDVI (${ndvi.toFixed(2)}). Possible disease, pest damage, or nutrient deficiency.`,
                timestamp: new Date().toISOString(),
            });
        }
    }

    // 4. Extreme temperature alerts
    if (temperature > 42) {
        alerts.push({
            type: "HEAT_STRESS",
            severity: "high",
            message: `Extreme heat detected (${temperature}°C). Crops at risk of heat stress.`,
            timestamp: new Date().toISOString(),
        });
    }

    if (temperature < 2) {
        alerts.push({
            type: "FROST_RISK",
            severity: "high",
            message: `Near-freezing temperature (${temperature}°C). Risk of frost damage.`,
            timestamp: new Date().toISOString(),
        });
    }

    return alerts;
}

// ═══════════════════════════════════════════════════════════════════
//  WATER SAVING POTENTIAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate water saving potential compared to flood irrigation.
 *
 * @param {Object} fieldState
 * @param {Object} irrigationStats - { totalLitersUsed, irrigationCount, avgDuration }
 * @returns {{ savingPercent, litersPerDay, costSavedINR }}
 */
export function calculateWaterSavings(fieldState, irrigationStats = {}) {
    const { field_area_sqm = 1000 } = fieldState;
    const { totalLitersUsed = 0, irrigationCount = 0, daysPeriod = 7 } = irrigationStats;

    // Flood irrigation uses ~5-8 L/sqm per session, typically daily
    const floodDailyLiters = field_area_sqm * 6; // 6 L/sqm average
    const floodTotalLiters = floodDailyLiters * daysPeriod;

    const actualDailyLiters =
        daysPeriod > 0 ? totalLitersUsed / daysPeriod : 0;

    const savingLiters = Math.max(0, floodTotalLiters - totalLitersUsed);
    const savingPercent =
        floodTotalLiters > 0
            ? Math.round((savingLiters / floodTotalLiters) * 100)
            : 0;

    // INR cost: ~0.05 INR per liter (typical borewell + electricity cost)
    const costSavedINR = Math.round(savingLiters * 0.05);

    return {
        savingPercent,
        litersPerDay: Math.round(actualDailyLiters),
        floodEquivalentLitersPerDay: floodDailyLiters,
        totalSavedLiters: Math.round(savingLiters),
        costSavedINR,
        irrigationCount,
        efficiencyRating:
            savingPercent > 50
                ? "Excellent"
                : savingPercent > 30
                    ? "Good"
                    : savingPercent > 10
                        ? "Fair"
                        : "Needs Improvement",
    };
}

// ═══════════════════════════════════════════════════════════════════
//  DRYING RATE PREDICTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Estimate hours until soil moisture drops below a threshold.
 * Uses a simplified exponential decay model influenced by
 * temperature and humidity (evapotranspiration factors).
 *
 * @param {number} currentMoisture - Current soil moisture %
 * @param {number} targetMoisture - Threshold to reach
 * @param {number} temperature - Current temp in °C
 * @param {number} humidity - Current humidity %
 * @returns {number} Estimated hours until threshold
 */
export function estimateDryingTime(
    currentMoisture,
    targetMoisture,
    temperature = 30,
    humidity = 50
) {
    if (currentMoisture <= targetMoisture) return 0;

    // Evapotranspiration factor (higher temp + lower humidity = faster drying)
    const etFactor = (temperature / 30) * ((100 - humidity) / 50);
    const baseDryingRate = 1.5; // % moisture loss per hour at standard conditions

    const effectiveDryingRate = baseDryingRate * Math.max(0.3, etFactor);
    const moistureToDrop = currentMoisture - targetMoisture;

    return Math.max(1, Math.round(moistureToDrop / effectiveDryingRate));
}

/**
 * Compute recommended irrigation time in minutes.
 */
export function computeIrrigationTime(waterQuantityLiters, flowRateLPM = 15) {
    if (waterQuantityLiters <= 0 || flowRateLPM <= 0) return 0;
    return Math.ceil(waterQuantityLiters / flowRateLPM);
}
