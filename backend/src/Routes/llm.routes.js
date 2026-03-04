import express from "express";
import { askAI } from "../controller/llm.controller.js";

const router = express.Router();

router.post("/ask-ai", askAI);

export default router;
