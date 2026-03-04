export const llmConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  apiKey: process.env.LLM_API_KEY,
  temperature: 0.3,
  maxTokens: 300
};
