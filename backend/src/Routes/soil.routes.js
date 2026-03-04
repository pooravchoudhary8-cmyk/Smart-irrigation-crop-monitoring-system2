import express from "express";
import multer from "multer";
import { soilService } from "../services/soil.service.js";

const router = express.Router();

// Configure multer for in-memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only images are allowed"), false);
        }
    },
});

/**
 * @route POST /api/soil/predict
 * @desc  Upload a soil image for classification
 */
router.post("/soil/predict", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }

        const result = await soilService.classifySoil(req.file.buffer, req.file.originalname);
        res.json(result);
    } catch (error) {
        console.error("Route Error (Soil Predict):", error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route GET /api/soil/labels
 * @desc  Get valid soil labels
 */
router.get("/soil/labels", async (req, res) => {
    try {
        const result = await soilService.getLabels();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
