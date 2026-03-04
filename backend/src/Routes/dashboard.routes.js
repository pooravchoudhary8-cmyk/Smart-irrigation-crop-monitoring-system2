import express from "express";
import { getDashboardData } from "../services/dashboard.service.js";

const router = express.Router();

router.get("/dashboard-data", getDashboardData);

export default router;
