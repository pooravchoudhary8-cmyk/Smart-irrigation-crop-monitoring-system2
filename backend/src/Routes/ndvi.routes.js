import { Router } from "express";
import {
    getFarmNDVI,
    getFarmNDVIHistory,
    computeNDVI,
    refreshFarmNDVI,
} from "../controller/ndvi.controller.js";

/**
 * NDVI Routes
 * ───────────
 * All routes are prefixed with /api in app.js
 *
 * GET  /api/ndvi/:farm_id           → Get latest NDVI for a farm
 * GET  /api/ndvi/:farm_id/history   → Get NDVI history
 * POST /api/ndvi/compute            → Compute NDVI from raw bands
 * POST /api/ndvi/:farm_id/refresh   → Force refresh NDVI from Sentinel Hub
 */
const router = Router();

// Fetch latest NDVI (with caching logic)
router.get("/ndvi/:farm_id", getFarmNDVI);

// Fetch NDVI history for trend analysis
router.get("/ndvi/:farm_id/history", getFarmNDVIHistory);

// Compute NDVI from NIR+Red bands
router.post("/ndvi/compute", computeNDVI);

// Force-refresh (clears cache, fetches from Sentinel Hub)
router.post("/ndvi/:farm_id/refresh", refreshFarmNDVI);

export default router;
