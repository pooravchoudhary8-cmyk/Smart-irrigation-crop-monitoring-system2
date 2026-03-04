import express from "express";
import { savePumpStatus } from "../controller/pump.controller.js";

const router = express.Router();

router.post("/pump-status", savePumpStatus);

export default router;
