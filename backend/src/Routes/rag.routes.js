import express from "express";
import { queryRAG, queryAdvisory, handleIrrigationPrediction } from "../controller/rag.controller.js";

const router = express.Router();

// Free-text RAG question
router.post("/rag/query", queryRAG);

// Sensor-aware smart advisory
router.post("/rag/advisory", queryAdvisory);

// ML Irrigation Prediction
router.post("/rag/irrigation/predict", handleIrrigationPrediction);

export default router;
