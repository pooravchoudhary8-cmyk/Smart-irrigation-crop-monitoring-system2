import { retrieveContext, getRAGAdvisory, predictIrrigation } from "../services/rag.service.js";

/**
 * POST /api/rag/query
 * Free-text agricultural question answered via ChromaDB + Gemini
 */
export const queryRAG = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ error: "question is required" });
    }

    const answer = await retrieveContext(question);
    res.json({ answer, source: "RAG+Gemini" });
  } catch (error) {
    console.error("❌ RAG query error:", error.message);
    res.status(500).json({ error: "RAG query failed" });
  }
};

/**
 * POST /api/rag/advisory
 * Accepts live sensor data + crop info → returns structured advisory
 * Used by frontend to get instant on-demand advice
 */
export const queryAdvisory = async (req, res) => {
  try {
    const {
      soil_moisture, soil1_moisture, soil2_moisture,
      temperature, humidity, rain_detected, rain_raw,
      pump_on, pump_mode,
      crop_type = "Wheat", crop_age_days = 45,
      weather_condition,
    } = req.body;

    const sensorData = {
      soil_moisture, soil1_moisture, soil2_moisture,
      temperature, humidity, rain_detected, rain_raw,
    };

    const cropInfo = {
      pump_on, pump_mode, crop_type, crop_age_days, weather_condition,
    };

    const advisory = await getRAGAdvisory(sensorData, cropInfo);

    if (!advisory) {
      return res.status(503).json({
        error: "RAG advisory service unavailable",
        fallback: true,
        action: rain_detected ? "PUMP_OFF" : soil_moisture < 30 ? "PUMP_ON" : "MONITOR",
      });
    }

    res.json(advisory);
  } catch (error) {
    console.error("❌ RAG advisory error:", error.message);
    res.status(500).json({ error: "Advisory failed" });
  }
};

/**
 * POST /api/rag/irrigation/predict
 * Calls the ML model via the RAG API service
 */
export const handleIrrigationPrediction = async (req, res) => {
  try {
    const prediction = await predictIrrigation(req.body);
    if (!prediction) {
      return res.status(503).json({ error: "Prediction service unavailable" });
    }
    res.json(prediction);
  } catch (error) {
    console.error("❌ Prediction controller error:", error.message);
    res.status(500).json({ error: "Prediction failed" });
  }
};
