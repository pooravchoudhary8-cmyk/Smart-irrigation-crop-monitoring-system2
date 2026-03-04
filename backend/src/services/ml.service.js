import dotenv from "dotenv";

dotenv.config();

const ML_API_URL = process.env.ML_API_URL || "http://localhost:8000";

/**
 * Get crop yield prediction using native fetch
 */
export const getYieldPrediction = async (data) => {
  try {
    const response = await fetch(`${ML_API_URL}/yield/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: data.city || data.area || "Delhi",
        latitude: data.latitude,
        longitude: data.longitude,
        pesticides_tonnes: data.pesticides || 500,
        crop: data.item || data.crop || "Wheat"
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("ML Prediction Error:", error.message);
    throw error;
  }
};

/**
 * Check irrigation status using ML/LLM using native fetch
 */
export const checkIrrigationML = async (data) => {
  try {
    const response = await fetch(`${ML_API_URL}/irrigation/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moisture: data.moisture,
        temperature: data.temperature,
        humidity: data.humidity,
        crop: data.crop || data.crop_type || "Wheat",
        soil_type: data.soil_type || "Black Soil",
        seedling_stage: data.seedling_stage || "Germination"
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Irrigation ML Error:", error.message);
    throw error;
  }
};

/**
 * General purpose ML run (placeholder)
 */
export const runPrediction = async () => {
  return { status: "Ready", service: "FastAPI ML System" };
};
