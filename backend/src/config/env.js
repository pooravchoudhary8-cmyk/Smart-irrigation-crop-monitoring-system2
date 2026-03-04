import "dotenv/config";

export const env = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI,
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
  LLM_API_KEY: process.env.LLM_API_KEY
};

export const validateEnv = () => {
  if (!env.MONGO_URI) {
    throw new Error("MONGO_URI missing in .env");
  }
};
