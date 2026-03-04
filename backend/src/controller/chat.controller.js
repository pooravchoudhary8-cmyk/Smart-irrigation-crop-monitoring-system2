import { generateReply, generateRAGReply, resetChat } from "../services/llm.service.js";

/**
 * POST /api/chat
 * Farmer chat powered by NewChatbot FastAPI server.
 * Supports English & Hindi via the `language` field.
 * The frontend can optionally pass live sensor data for contextual answers.
 */
export async function chatWithKisan(req, res) {
    try {
        const { messages, language, locationContext, sensorContext } = req.body;
        const lastMessage = messages?.[messages.length - 1]?.text || "";

        if (!lastMessage.trim()) {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        const lang = language || "english";
        console.log(`💬 Chat request (${lang}): "${lastMessage}"`);

        // Use sensor-enriched reply if sensor context is available; else plain reply
        const reply = sensorContext
            ? await generateRAGReply(lastMessage, sensorContext, lang)
            : await generateReply(lastMessage, lang);

        console.log(`🤖 Reply generated (${reply.length} chars) [lang: ${lang}, sensors: ${!!sensorContext}]`);

        res.json({ reply });
    } catch (err) {
        console.error("Chat error:", err);
        res.status(500).json({ error: "Chat failed", reply: "I'm sorry, something went wrong. Please try again." });
    }
}

export async function resetChatSession(req, res) {
    try {
        resetChat();
        res.json({ success: true, message: "Chat session reset" });
    } catch (err) {
        console.error("Reset error:", err);
        res.status(500).json({ error: "Failed to reset chat" });
    }
}
