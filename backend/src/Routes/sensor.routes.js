import express from "express";
import {
  saveSensorData,
  getSensorData
} from "../controller/sensor.controller.js";

const router = express.Router();

router.post("/sensor-data", saveSensorData);
router.get("/sensor-data", getSensorData);

export default router;

