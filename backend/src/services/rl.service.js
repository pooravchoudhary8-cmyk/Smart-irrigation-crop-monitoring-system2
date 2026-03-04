import dotenv from "dotenv";

dotenv.config();

const RL_API_URL = process.env.RL_API_URL || "http://localhost:8001";

/**
 * Get RL-based irrigation decision from the Python microservice
 */
export const getRLIrrigationAction = async (sensorData) => {
    try {
        const response = await fetch(`${RL_API_URL}/rl/irrigation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                soil_moisture: sensorData.soil_moisture,
                temperature: sensorData.temperature,
                humidity: sensorData.humidity,
                rain: sensorData.rain_detected ? 1.0 : 0.0,
                crop_stage: 2.0, // Default vegetative stage
                ndvi: sensorData.ndvi ?? 0.5
            })
        });

        if (!response.ok) {
            // Failing silently or returning null if RL service is down to avoid crashing main flow
            console.warn(`⚠️ [RL SERVICE] API returned status ${response.status}`);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("❌ RL Prediction Service Error:", error.message);
        return null;
    }
};
