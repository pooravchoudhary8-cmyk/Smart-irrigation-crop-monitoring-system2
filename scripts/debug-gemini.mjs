import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function test() {
    const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    console.log("Using Key:", key ? key.substring(0, 10) + "..." : "MISSING");

    if (!key) return;

    const models = [
        "gemini-1.5-flash",
        "models/gemini-1.5-flash",
        "gemini-pro",
        "gemini-1.0-pro"
    ];

    for (const modelName of models) {
        try {
            console.log(`\n--- Testing ${modelName} ---`);
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hi, tell me one farming tip.");
            console.log(`✅ ${modelName} works!`);
            console.log("Response:", result.response.text().trim());
        } catch (err) {
            console.log(`❌ ${modelName} failed:`, err.message);
        }
    }
}

test();
