import express from "express";
import { addManualEntry } from "../controller/manual.controller.js";

const router = express.Router();

router.post("/manual-entry", addManualEntry);

export default router;

