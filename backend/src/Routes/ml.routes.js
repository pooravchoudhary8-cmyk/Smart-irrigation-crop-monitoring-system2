import express from "express";
import { getPrediction } from "../controller/ml.controller.js";

const router = express.Router();

router.post("/predict", getPrediction);

export default router;
