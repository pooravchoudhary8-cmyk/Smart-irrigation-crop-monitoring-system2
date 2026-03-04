import express from "express";
import { chatWithKisan, resetChatSession } from "../controller/chat.controller.js";

const router = express.Router();

router.post("/chat", chatWithKisan);
router.post("/chat/reset", resetChatSession);

export default router;
