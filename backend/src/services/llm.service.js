import axios from "axios";

/**
 * llm.service.js
 * Chatbot service powered by the NewChatbot FastAPI server.
 * Sends questions to the NewChatbot API (HuggingFace Inference via FastAPI).
 *
 * NewChatbot API endpoints:
 *   POST /chat/english  { question } => { answer, language }
 *   POST /chat/hindi    { question } => { answer, language }
 *   GET  /health        => { status, service }
 */

const CHATBOT_API_URL = process.env.CHATBOT_API_URL || "http://localhost:8000";

const HF_MODEL = "HuggingFaceH4/zephyr-7b-beta";

const SYSTEM_PROMPT_EN = [
  "You are Kissan, an Indian agriculture expert AI assistant for the Smart Irrigation System.",
  "",
  "Help farmers with:",
  "- crop diseases and diagnosis",
  "- fertilizers and nutrient management",
  "- irrigation scheduling and techniques",
  "- soil health and pH management",
  "- pest control and prevention",
  "- organic farming practices",
  "- government schemes for farmers",
  "- market advice and pricing",
  "- weather impact on crops",
  "- crop rotation and planning",
  "- water conservation techniques",
  "",
  "STRICT OPERATING RULES:",
  "1. ONLY answer questions related to agriculture, farming, crops, irrigation, soil, and weather-impact on farms.",
  "2. If a user asks ANY question NOT related to farming, politely refuse.",
  "3. Provide data-driven, precise, and actionable advice.",
  "4. Always respond in English.",
  "5. Be concise but highly technical about agricultural optimization.",
  "6. Give practical step-by-step advice when possible.",
  "7. Reference specific crop varieties, fertilizer brands, or pesticides when relevant.",
  "",
  "Focus areas: Irrigation scheduling, fertilizer use, pest control, crop rotation, water conservation, and smart farming technology.",
].join("\n");

const SYSTEM_PROMPT_HI = [
  "\u0906\u092A \u0915\u093F\u0938\u093E\u0928 \u0939\u0948\u0902, \u0938\u094D\u092E\u093E\u0930\u094D\u091F \u0938\u093F\u0902\u091A\u093E\u0908 \u092A\u094D\u0930\u0923\u093E\u0932\u0940 \u0915\u0947 \u0932\u093F\u090F \u090F\u0915 \u092D\u093E\u0930\u0924\u0940\u092F \u0915\u0943\u0937\u093F \u0935\u093F\u0936\u0947\u0937\u091C\u094D\u091E AI \u0938\u0939\u093E\u092F\u0915\u0964",
  "",
  "\u0915\u093F\u0938\u093E\u0928\u094B\u0902 \u0915\u0940 \u092E\u0926\u0926 \u0915\u0930\u0947\u0902:",
  "- \u092B\u0938\u0932 \u0930\u094B\u0917 \u0914\u0930 \u0928\u093F\u0926\u093E\u0928",
  "- \u0909\u0930\u094D\u0935\u0930\u0915 \u0914\u0930 \u092A\u094B\u0937\u0915 \u0924\u0924\u094D\u0935 \u092A\u094D\u0930\u092C\u0902\u0927\u0928",
  "- \u0938\u093F\u0902\u091A\u093E\u0908 \u0938\u092E\u092F\u0938\u0942\u091A\u0940 \u0914\u0930 \u0924\u0915\u0928\u0940\u0915",
  "- \u092E\u093F\u091F\u094D\u091F\u0940 \u0915\u0940 \u0938\u0947\u0939\u0924 \u0914\u0930 pH \u092A\u094D\u0930\u092C\u0902\u0927\u0928",
  "- \u0915\u0940\u091F \u0928\u093F\u092F\u0902\u0924\u094D\u0930\u0923 \u0914\u0930 \u0930\u094B\u0915\u0925\u093E\u092E",
  "- \u091C\u0948\u0935\u093F\u0915 \u0916\u0947\u0924\u0940",
  "- \u0938\u0930\u0915\u093E\u0930\u0940 \u092F\u094B\u091C\u0928\u093E\u090F\u0902",
  "- \u092C\u093E\u091C\u093E\u0930 \u0938\u0932\u093E\u0939 \u0914\u0930 \u092E\u0942\u0932\u094D\u092F",
  "",
  "\u0938\u0916\u094D\u0924 \u0928\u093F\u092F\u092E:",
  "1. \u0915\u0947\u0935\u0932 \u0915\u0943\u0937\u093F, \u0916\u0947\u0924\u0940, \u092B\u0938\u0932, \u0938\u093F\u0902\u091A\u093E\u0908, \u092E\u093F\u091F\u094D\u091F\u0940 \u0938\u0947 \u0938\u0902\u092C\u0902\u0927\u093F\u0924 \u092A\u094D\u0930\u0936\u094D\u0928\u094B\u0902 \u0915\u093E \u0909\u0924\u094D\u0924\u0930 \u0926\u0947\u0902\u0964",
  "2. \u092F\u0926\u093F \u0909\u092A\u092F\u094B\u0917\u0915\u0930\u094D\u0924\u093E \u0916\u0947\u0924\u0940 \u0938\u0947 \u0938\u0902\u092C\u0902\u0927\u093F\u0924 \u0928\u0939\u0940\u0902 \u0915\u0941\u091B \u092A\u0942\u091B\u0947, \u0924\u094B \u0935\u093F\u0928\u092E\u094D\u0930\u0924\u093E \u0938\u0947 \u092E\u0928\u093E \u0915\u0930\u0947\u0902\u0964",
  "3. \u0921\u0947\u091F\u093E-\u0938\u0902\u091A\u093E\u0932\u093F\u0924, \u0938\u091F\u0940\u0915 \u0914\u0930 \u0915\u093E\u0930\u094D\u0930\u0935\u093E\u0908 \u092F\u094B\u0917\u094D\u092F \u0938\u0932\u093E\u0939 \u0926\u0947\u0902\u0964",
  "4. \u0939\u092E\u0947\u0936\u093E \u0939\u093F\u0902\u0926\u0940 \u092E\u0947\u0902 \u0909\u0924\u094D\u0924\u0930 \u0926\u0947\u0902, \u092D\u0932\u0947 \u0939\u0940 \u0938\u0935\u093E\u0932 \u0905\u0902\u0917\u094D\u0930\u0947\u091C\u0940 \u092E\u0947\u0902 \u092A\u0942\u091B\u093E \u0917\u092F\u093E \u0939\u094B\u0964",
  "5. \u0938\u0902\u0915\u094D\u0937\u093F\u092A\u094D\u0924 \u0932\u0947\u0915\u093F\u0928 \u0924\u0915\u0928\u0940\u0915\u0940 \u0909\u0924\u094D\u0924\u0930 \u0926\u0947\u0902\u0964",
  "6. \u0935\u094D\u092F\u093E\u0935\u0939\u093E\u0930\u093F\u0915 \u091A\u0930\u0923-\u0926\u0930-\u091A\u0930\u0923 \u0938\u0932\u093E\u0939 \u0926\u0947\u0902\u0964",
].join("\n");

/**
 * Detect language from user message (simple heuristic)
 */
const detectLanguage = (text) => {
  const hindiPattern = /[\u0900-\u097F]/;
  return hindiPattern.test(text) ? "hindi" : "english";
};

/**
 * Fallback: Direct HuggingFace call if NewChatbot API is down.
 * Uses the correct system prompt based on language.
 */
const callHuggingFaceDirect = async (prompt, language = "english") => {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACEHUB_API_TOKEN;

  if (!token) {
    console.error("No HuggingFace Token found. Set HF_TOKEN in .env");
    return language === "hindi"
      ? "\u091A\u0948\u091F\u092C\u0949\u091F \u0938\u0947\u0935\u093E \u0905\u092D\u0940 \u0909\u092A\u0932\u092C\u094D\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964"
      : "Chatbot service is not available right now. Please try again.";
  }

  const systemPrompt = language === "hindi" ? SYSTEM_PROMPT_HI : SYSTEM_PROMPT_EN;

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        inputs: `<|system|>\n${systemPrompt}</s>\n<|user|>\n${prompt}</s>\n<|assistant|>`,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    let result = "";
    if (Array.isArray(response.data)) {
      result = response.data[0].generated_text;
    } else {
      result = response.data.generated_text;
    }

    if (result.includes("<|assistant|>")) {
      result = result.split("<|assistant|>").pop().trim();
    }

    return result;
  } catch (error) {
    console.error("HuggingFace API Error:", error.response?.data || error.message);
    return language === "hindi"
      ? "\u091A\u0948\u091F\u092C\u0949\u091F \u0938\u0947\u0935\u093E \u0938\u0947 \u0915\u0928\u0947\u0915\u094D\u091F \u0928\u0939\u0940\u0902 \u0939\u094B \u092A\u093E \u0930\u0939\u093E\u0964 \u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964"
      : "I'm unable to connect to the chatbot service right now. Please try again.";
  }
};

/**
 * Generate a reply using the NewChatbot FastAPI server.
 * Calls POST /chat/english or /chat/hindi based on the language parameter.
 * When Hindi mode is selected, adds a Hindi instruction to ensure Hindi response.
 *
 * @param {string} question - The user's question
 * @param {string} [language] - 'english' or 'hindi' (optional, auto-detected if not provided)
 */
export const generateReply = async (question, language = null) => {
  try {
    const lang = language || detectLanguage(question);
    const endpoint = `${CHATBOT_API_URL}/chat/${lang}`;

    // If Hindi mode is selected but the question is in English,
    // prepend an instruction to respond in Hindi
    let finalQuestion = question;
    if (lang === "hindi" && detectLanguage(question) === "english") {
      finalQuestion = "[IMPORTANT: You MUST respond in Hindi (Devanagari script). The user has selected Hindi mode.]\n\n" + question;
    }

    console.log(`Chatbot: Sending to NewChatbot API (${lang}): "${question.substring(0, 50)}..."`);

    const response = await axios.post(
      endpoint,
      { question: finalQuestion },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );

    const answer = response.data?.answer || (lang === "hindi"
      ? "\u0909\u0924\u094D\u0924\u0930 \u0924\u0948\u092F\u093E\u0930 \u0928\u0939\u0940\u0902 \u0939\u094B \u0938\u0915\u093E\u0964 \u0915\u0943\u092A\u092F\u093E \u092A\u0941\u0928\u0903 \u092A\u094D\u0930\u092F\u093E\u0938 \u0915\u0930\u0947\u0902\u0964"
      : "I couldn't generate a response. Please try again.");
    console.log(`Chatbot: Reply received (${answer.length} chars)`);
    return answer;
  } catch (error) {
    console.error("NewChatbot API Error:", error.message);
    return callHuggingFaceDirect(question, language || "english");
  }
};

/**
 * Generate a reply with optional sensor context.
 * Includes live sensor data in the question for contextual answers.
 *
 * @param {string} question - The user's question
 * @param {Object|null} sensorContext - Live sensor data (optional)
 * @param {string} [language] - 'english' or 'hindi' (optional)
 */
export const generateRAGReply = async (question, sensorContext = null, language = null) => {
  try {
    let fullQuestion = question;

    if (sensorContext) {
      const sensorLabel = (language === "hindi")
        ? "\u0932\u093E\u0907\u0935 \u092B\u093E\u0930\u094D\u092E \u0938\u0947\u0902\u0938\u0930 \u0921\u0947\u091F\u093E:"
        : "LIVE FARM SENSOR DATA (use this for precise advice):";
      const questionLabel = (language === "hindi")
        ? "\u0915\u093F\u0938\u093E\u0928 \u0915\u093E \u0938\u0935\u093E\u0932:"
        : "Farmer Question:";

      fullQuestion = `${sensorLabel}
- Soil Moisture : ${sensorContext.soil_moisture ?? "N/A"}%
- Temperature   : ${sensorContext.temperature ?? "N/A"}C
- Humidity      : ${sensorContext.humidity ?? "N/A"}%
- Rain Detected : ${sensorContext.rain_detected ? "Yes" : "No"}
- Pump Status   : ${sensorContext.pump_on ? "ON" : "OFF"}

${questionLabel} ${question}`;
    }

    return generateReply(fullQuestion, language);
  } catch (error) {
    console.error("Contextual reply error:", error.message);
    return generateReply(question, language);
  }
};

/**
 * Reset the chat session
 */
export const resetChat = () => {
  console.log("Chat session reset (stateless for NewChatbot)");
};

export const generateResponse = generateReply;
