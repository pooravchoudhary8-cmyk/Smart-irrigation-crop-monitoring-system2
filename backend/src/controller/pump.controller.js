export const savePumpStatus = async (req, res) => {
  try {
    const { pumpOn, mode, reason } = req.body;

    console.log("🚰 Pump Status:", { pumpOn, mode, reason });

    // Get MQTT client and topics from Express app
    const mqttClient = req.app.get("mqttClient");
    const mqttControlTopic = req.app.get("mqttMotorTopic") || "farm/pumpControl";

    if (!mqttClient || !mqttClient.connected) {
      console.warn("⚠️ MQTT client not connected. Simulating pump command for UI.");
      return res.json({ success: true, published: payload, simulated: true });
    }

    let payload = "AUTO";

    if (mode === "MANUAL") {
      payload = pumpOn ? "MANUAL_ON" : "MANUAL_OFF";
    } else {
      payload = "AUTO";
    }

    // Publish command to Arduino — QoS 1 ensures delivery even on noisy public brokers
    mqttClient.publish(mqttControlTopic, payload, { qos: 1, retain: false }, (err) => {
      if (err) {
        console.error("❌ MQTT publish failed:", err);
        return res.status(500).json({ error: "Command failed" });
      }
      console.log(`✅ Command Sent to Arduino: ${payload} → ${mqttControlTopic}`);
      res.json({ success: true, published: payload });
    });
  } catch (err) {
    console.error("❌ Pump controller error:", err);
    res.status(500).json({ error: "Failed to save pump status" });
  }
};
