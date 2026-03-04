import { generateResponse } from "../services/llm.service.js";

export const askAI = async (req, res) => {
  try {
    const { question } = req.body;

    const answer = await generateResponse(question);

    res.json({ answer });
  } catch (error) {
    res.status(500).json({
      error: "AI response failed"
    });
  }
};
