import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Force use ONLY the GEMINI_API_KEY (frontend key - different project, different quota)
const key = process.env.GEMINI_API_KEY;
console.log("Using GEMINI_API_KEY:", key ? key.substring(0, 12) + "..." : "MISSING");

for (const model of ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash"]) {
    try {
        console.log(`\nTesting model: ${model}...`);
        const genAI = new GoogleGenerativeAI(key);
        const m = genAI.getGenerativeModel({ model });
        const result = await m.generateContent("You are a farming expert. In one short sentence, what is the best fertilizer for wheat?");
        console.log(`✅ SUCCESS with ${model}:`, result.response.text().trim().slice(0, 200));
        break;
    } catch (err) {
        console.log(`❌ ${model} failed:`, err.message?.slice(0, 150));
    }
}
