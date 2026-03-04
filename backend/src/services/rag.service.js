/**
 * rag.service.js
 * ──────────────
 * Connects the Node.js backend to the Python RAG FastAPI microservice
 * running on port 8001.
 *
 * If the RAG API is offline the functions resolve gracefully so the
 * rest of the pipeline (Gemini LLM, Socket.IO) is never blocked.
 */

const RAG_API_URL = process.env.RAG_API_URL || "http://localhost:8000";
const RAG_TIMEOUT_MS = 8000; // Give ChromaDB retrieval up to 8 s

/**
 * Fetches context chunks from ChromaDB for a free-text question.
 * @param {string} question
 * @returns {Promise<string>} retrieved context, or "" on failure
 */
export const retrieveContext = async (question) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

    const res = await fetch(`${RAG_API_URL}/rag/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`⚠️  [RAG] Query returned HTTP ${res.status}`);
      return "";
    }

    const data = await res.json();
    return data.answer || "";
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("⏱️  [RAG] Query timed out — continuing without RAG context");
    } else {
      console.warn("⚠️  [RAG] Service unavailable:", err.message);
    }
    return "";
  }
};

/**
 * Calls the /rag/advisory endpoint with live sensor + crop data.
 * Returns a structured advisory object or null on failure.
 *
 * @param {Object} sensorData  - live sensor reading from MQTT
 * @param {Object} cropInfo    - { crop_type, crop_age_days }
 * @returns {Promise<Object|null>}
 */
export const getRAGAdvisory = async (sensorData, cropInfo = {}) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

    const payload = {
      soil_moisture: sensorData.soil_moisture ?? 0,
      soil1_moisture: sensorData.soil1_moisture ?? null,
      soil2_moisture: sensorData.soil2_moisture ?? null,
      temperature: sensorData.temperature ?? 0,
      humidity: sensorData.humidity ?? 0,
      rain_detected: sensorData.rain_detected ?? false,
      rain_raw: sensorData.rain_raw ?? null,
      pump_on: cropInfo.pump_on ?? false,
      pump_mode: cropInfo.pump_mode ?? "AUTO",
      crop_type: cropInfo.crop_type ?? "Wheat",
      crop_age_days: cropInfo.crop_age_days ?? 45,
      ndvi: sensorData.ndvi ?? 0.5,
      weather_condition: cropInfo.weather_condition ?? null,
    };

    const res = await fetch(`${RAG_API_URL}/rag/advisory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`⚠️  [RAG] Advisory returned HTTP ${res.status}`);
      return null;
    }

    const advisory = await res.json();
    console.log(`🌾 [RAG] Advisory: ${advisory.action} | Confidence: ${advisory.confidence}`);
    return advisory;
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("⏱️  [RAG] Advisory timed out — skipping this cycle");
    } else {
      console.warn("⚠️  [RAG] Advisory service unavailable:", err.message);
    }
    return null;
  }
};

/**
 * Calls the /irrigation/predict endpoint on the RAG API.
 * @param {Object} data - { moisture, temperature, humidity, crop, soil_type, seedling_stage }
 * @returns {Promise<Object|null>}
 */
export const predictIrrigation = async (data) => {
  try {
    const res = await fetch(`${RAG_API_URL}/irrigation/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moisture: data.moisture,
        temperature: data.temperature,
        humidity: data.humidity,
        crop: data.crop,
        soil_type: data.soil_type,
        seedling_stage: data.seedling_stage,
      }),
    });

    if (!res.ok) {
      console.warn(`⚠️  [RAG] Prediction returned HTTP ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn("⚠️  [RAG] Prediction service failed:", err.message);
    return null;
  }
};
