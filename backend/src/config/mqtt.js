import mqtt from "mqtt";

export const mqttClient = mqtt.connect(
  process.env.MQTT_BROKER_URL || "mqtt://localhost:1883"
);

mqttClient.on("connect", () => {
  console.log("MQTT connected");
});

mqttClient.on("error", (err) => {
  console.error("MQTT error:", err.message);
});
