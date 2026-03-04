import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function listModels() {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.log("No API Key found in .env");
            return;
        }
        console.log("Testing API Key starting with:", apiKey.substring(0, 10));

        const genAI = new GoogleGenerativeAI(apiKey);
        const result = await genAI.listModels();
        console.log("--- START MODEL LIST ---");
        result.models.forEach(model => {
            console.log(`MODEL: ${model.name}`);
        });
        console.log("--- END MODEL LIST ---");
        process.exit(0);
    } catch (e) {
        console.error("CRITICAL ERROR:", e.message);
        process.exit(1);
    }
}

listModels();
