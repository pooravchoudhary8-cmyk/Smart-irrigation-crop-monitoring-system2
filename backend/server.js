
// ─────────────────────────────────────────────────────────────
//  Load .env FIRST — always before any other imports
// ─────────────────────────────────────────────────────────────
import "dotenv/config";
import http from "http";
import mqtt from "mqtt";
import express from "express";
import { Server } from "socket.io";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { validateEnv } from "./src/config/env.js";
import { intelligenceService } from "./src/services/intelligence.service.js";
import { getRLIrrigationAction } from "./src/services/rl.service.js";
import { computeNDVI } from "./src/services/ndvi.service.js";
import { ingestSensorData } from "./src/services/fusionEngine.service.js";

// ─── Validate & Connect DB ────────────────────────────────────
validateEnv();
connectDB();

// ─── HTTP + Socket.IO Setup ───────────────────────────────────
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── Initialize Intelligence Engine ───────────────────────────
intelligenceService.init(io);

let latestMqttData = null;
let currentMode = "AUTO";   // Track mode: AUTO | MANUAL — updated when frontend sends command
let pumpIsOn = false;    // Track last known pump state to avoid duplicate commands

// ─── Auto Pump Decision Engine ────────────────────────────────
// Called every time new sensor data arrives.
// Thresholds:
//   rain_raw < RAIN_THRESHOLD      → rain is falling  → FORCE pump OFF
//   soil_moisture > MOISTURE_HIGH  → soil is wet enough → turn pump OFF
//   soil_moisture < MOISTURE_LOW   → soil is dry        → turn pump ON
const RAIN_THRESHOLD = 2500;  // ADC value below this = rain detected
const MOISTURE_LOW = 30;    // % — below this, pump turns ON in auto
const MOISTURE_HIGH = 60;    // % — above this, pump turns OFF in auto


function runAutoPump(data) {
  if (currentMode !== "AUTO") return; // Only act in AUTO mode

  const rainDetected = data.rain_raw !== null && Number(data.rain_raw) < RAIN_THRESHOLD;
  const soilMoisture = data.soil_moisture ?? 0;

  let shouldPumpBeOn = pumpIsOn; // Default: keep current state

  if (rainDetected) {
    shouldPumpBeOn = false; // Rain → always OFF
  } else if (soilMoisture < MOISTURE_LOW) {
    shouldPumpBeOn = true;  // Dry soil, no rain → ON
  } else if (soilMoisture >= MOISTURE_HIGH) {
    shouldPumpBeOn = false; // Wet enough → OFF
  }

  // Only publish if state actually changed — avoids flooding MQTT
  if (shouldPumpBeOn === pumpIsOn) return;

  const command = shouldPumpBeOn ? "AUTO_ON" : "AUTO_OFF";
  pumpIsOn = shouldPumpBeOn;

  mqttClient.publish(MQTT_MOTOR, command, { qos: 0 }, (err) => {
    if (err) {
      console.error(`❌ [AUTO] Failed to publish ${command}:`, err.message);
    } else {
      const reason = rainDetected
        ? "Rain detected"
        : shouldPumpBeOn
          ? `Soil dry (${soilMoisture}% < ${MOISTURE_LOW}%)`
          : `Soil sufficient (${soilMoisture}% ≥ ${MOISTURE_HIGH}%)`;
      console.log(`🤖 [AUTO] Pump → ${command} | Reason: ${reason}`);
      // Notify frontend of pump state change
      io.emit("pump-state", { pumpOn: shouldPumpBeOn, mode: "AUTO", reason });
    }
  });
}

io.on("connection", (socket) => {
  console.log(`🖥️  [Socket.IO] Client connected   : ${socket.id}`);
  // Send last known data immediately on connect
  if (latestMqttData) {
    socket.emit("sensor-data", latestMqttData);
  }
  socket.on("disconnect", () => {
    console.log(`🖥️  [Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// ─── MQTT Configuration ───────────────────────────────────────
const MQTT_BROKER = process.env.MQTT_BROKER_URL || "mqtt://test.mosquitto.org:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "farm/sensorData";
const MQTT_MOTOR = process.env.MQTT_MOTOR_TOPIC || "farm/pumpControl";
const MQTT_MODE = process.env.MQTT_MODE_TOPIC || "farm/pumpControl";
const MQTT_NDVI = "farm/ndvi";
const MQTT_CLIENT_ID = `smart_farm_${Date.now()}`;

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🔌 MQTT Configuration");
console.log(`   Broker    : ${MQTT_BROKER}`);
console.log(`   Topic     : ${MQTT_TOPIC}`);
console.log(`   Client ID : ${MQTT_CLIENT_ID}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId: MQTT_CLIENT_ID,
  keepalive: 60,    // PING every 60s to stay connected
  reconnectPeriod: 3000,  // Retry every 3s after disconnect
  connectTimeout: 30000, // 30s initial connection timeout
  clean: true,
});

// Expose MQTT client to controllers
app.set("mqttClient", mqttClient);
app.set("mqttMotorTopic", MQTT_MOTOR);
app.set("mqttModeTopic", MQTT_MODE);

// ─── MQTT Events ──────────────────────────────────────────────
mqttClient.on("connect", () => {
  console.log("✅ [MQTT] Connected to broker:", MQTT_BROKER);

  // Subscribe to sensor data topic
  mqttClient.subscribe(MQTT_TOPIC, { qos: 0 }, (err) => {
    if (err) {
      console.error(`❌ [MQTT] Subscription FAILED for topic: "${MQTT_TOPIC}"`, err.message);
    } else {
      console.log(`📡 [MQTT] Subscribed — waiting for data on: "${MQTT_TOPIC}"`);
      console.log("   ⏳ Listening... (make sure Arduino publishes to the same topic & broker)\n");
    }
  });

  // Subscribe to pump control topic to track mode changes from frontend/Arduino
  mqttClient.subscribe(MQTT_MOTOR, { qos: 0 }, (err) => {
    if (!err) console.log(`🎛️  [MQTT] Monitoring pump topic: "${MQTT_MOTOR}"`);
  });
});

mqttClient.on("reconnect", () => {
  console.log("🔄 [MQTT] Reconnecting to broker...");
});

mqttClient.on("offline", () => console.warn("⚠️  [MQTT] Client went offline"));
mqttClient.on("error", (err) => console.error("❌ [MQTT] Error:", err.message));
mqttClient.on("close", () => console.warn("🔌 [MQTT] Connection closed"));

// ─── MQTT Message Handler ─────────────────────────────────────
mqttClient.on("message", (topic, message) => {
  try {
    const raw = message.toString().trim();

    console.log("\n══════════════════════════════════════════════════");
    console.log(`📨 [MQTT] Message received on: "${topic}"`);
    console.log(`   RAW : ${raw}`);

    // ── Step 1: Extract JSON block from raw message ──
    let data = null;
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      let jsonStr = raw.slice(jsonStart, jsonEnd + 1);
      // Clean up common Arduino/ESP serialization issues
      jsonStr = jsonStr.replace(/:nan\b/gi, ":null")
        .replace(/:inf\b/gi, ":null")
        .replace(/[^\x20-\x7E]/g, ""); // Remove non-printable chars

      try {
        data = JSON.parse(jsonStr);
      } catch (e) {
        console.warn(`   JSON: Parse failed (${e.message}) — using regex fallback`);
      }
    }

    // ── Step 2: Extract individual fields (JSON or regex) ──
    const findValue = (keys) => {
      for (const key of keys) {
        if (data && data[key] !== undefined && data[key] !== null) return Number(data[key]);
        const regex = new RegExp(`["']?${key}["']?\\s*[:=]\\s*([-\\d.]+)`, "i");
        const match = raw.match(regex);
        if (match && match[1] !== "") return Number(match[1]);
      }
      return null;
    };

    const s1Raw = findValue(["soil1", "soil1_moisture", "Soil1", "soil_avg"]);
    const s2Raw = findValue(["soil2", "soil2_moisture", "Soil2"]);
    const tempRaw = findValue(["temp", "temperature", "tempC"]);
    const humRaw = findValue(["humidity", "hum"]);
    const rainRaw = findValue(["rain", "rain_raw", "rainfall", "rain_binary"]);

    // ── Step 3: ADC → % conversion for soil sensors ──
    const toPct = (val) => {
      if (val === null || val === undefined || isNaN(val)) return null;
      if (val >= 0 && val <= 100) return Math.round(val);          // already %
      return Math.round(Math.max(0, Math.min(100, ((4095 - val) / 4095) * 100))); // 12-bit ADC
    };

    const soil1Pct = toPct(s1Raw);
    const soil2Pct = toPct(s2Raw);

    let finalMoisture = 0;
    if (soil1Pct !== null && soil2Pct !== null) finalMoisture = (soil1Pct + soil2Pct) / 2;
    else finalMoisture = soil1Pct ?? soil2Pct ?? 0;

    const formattedData = {
      soil_moisture: Math.round(finalMoisture),
      soil1_moisture: soil1Pct ?? (s1Raw !== null ? toPct(s1Raw) : null), // ensure s1 is never null if we have s1Raw
      soil2_moisture: soil2Pct,
      temperature: tempRaw ?? 0,
      humidity: humRaw ?? 0,
      rain_raw: rainRaw ?? null,
      rain_detected: rainRaw !== null ? (Number(rainRaw) === 1 || Number(rainRaw) < 2500) : false,
    };

    // ── Step 4: Glitch Guard — Detect ESP32 reset ──
    // Strict Check: only trigger if ALL primary sensors are exactly 0.
    // Genuine zero soil moisture or zero temp is possible, but not all together.
    const isGlitch = (
      s1Raw === 0 &&
      tempRaw === 0 &&
      humRaw === 0 &&
      latestMqttData !== null
    );

    if (isGlitch && latestMqttData) {
      console.warn("⚡ [GLITCH] All-zero reading detected — likely pump power surge.");
      console.warn("   Holding last good values. Fix: use separate power supply for pump!");
      console.log("══════════════════════════════════════════════════\n");
      return; // Don't update latestMqttData or broadcast zeros
    }

    // Merge: if individual fields drop to null/0 suddenly (partial glitch),
    // keep last good value for that field.
    // DHT sensors are especially vulnerable to pump motor power spikes —
    // they often report NaN (→ null) or 0 when VCC droops even 0.5V.
    if (latestMqttData) {
      const dhtTempFailed = (formattedData.temperature === 0 || formattedData.temperature === null)
        && latestMqttData.temperature > 0;
      const dhtHumFailed = (formattedData.humidity === 0 || formattedData.humidity === null)
        && latestMqttData.humidity > 0;

      if (dhtTempFailed || dhtHumFailed) {
        console.warn("🌡️  [DHT FAIL] Sensor drop detected — likely pump power noise.");
        console.warn("   Holding last good Temp & Humidity. Fix: add 100µF cap near DHT!");
      }

      if (dhtTempFailed) formattedData.temperature = latestMqttData.temperature;
      if (dhtHumFailed) formattedData.humidity = latestMqttData.humidity;

      if (formattedData.soil1_moisture === null && latestMqttData.soil1_moisture !== null)
        formattedData.soil1_moisture = latestMqttData.soil1_moisture;
      if (formattedData.soil2_moisture === null && latestMqttData.soil2_moisture !== null)
        formattedData.soil2_moisture = latestMqttData.soil2_moisture;
    }

    latestMqttData = formattedData;

    // ── Step 5: Print parsed result ──
    console.log("   PARSED DATA:");
    console.log(`     Soil 1 Moisture : ${formattedData.soil1_moisture ?? "N/A"}%`);
    console.log(`     Soil 2 Moisture : ${formattedData.soil2_moisture ?? "N/A"}%`);
    console.log(`     Avg  Moisture   : ${formattedData.soil_moisture}%`);
    console.log(`     Temperature     : ${formattedData.temperature}°C`);
    console.log(`     Humidity        : ${formattedData.humidity}%`);
    console.log(`     Rain Raw        : ${formattedData.rain_raw ?? "N/A"}`);
    console.log(`     Rain Detected   : ${formattedData.rain_detected}`);
    console.log("══════════════════════════════════════════════════\n");

    // ── Step 6: Broadcast to all frontend clients via Socket.IO ──
    io.emit("sensor-data", formattedData);

    // ── Step 7: Auto pump decision (only runs in AUTO mode) ──
    runAutoPump(formattedData);

    // ── Step 8: Comprehensive Intelligence Orchestration ──
    // Runs the AI Intelligence Engine pipeline
    intelligenceService.processSensorData(formattedData, {
      pumpOn: pumpIsOn,
      pumpMode: currentMode,
      cropType: latestMqttData?.cropType || "Wheat",
      soilType: latestMqttData?.soilType || "Loamy",
      cropStage: latestMqttData?.cropStage || "vegetative",
    }).catch((err) => console.error("❌ Intelligence Engine unhandled:", err.message));

    // ── Step 8b: Ingest into Data Fusion Intelligence Engine ──
    ingestSensorData("default_farm", formattedData, {
      pumpOn: pumpIsOn,
      pumpMode: currentMode,
    });

    // ── Step 9: NDVI Remote Sensing Engine — compute & publish ──
    computeNDVI(formattedData.soil_moisture)
      .then((ndviResult) => {
        if (ndviResult) {
          console.log(`🛰️  [NDVI] Score: ${ndviResult.score} | Health: ${ndviResult.health_status}`);
          // Publish to MQTT for external listeners (Requested format)
          const mqttPayload = {
            ndvi: ndviResult.score,
            health: ndviResult.health_status,
            confidence: ndviResult.confidence || 0.92
          };
          mqttClient.publish(MQTT_NDVI, JSON.stringify(mqttPayload), { qos: 0 });
          // Broadcast to frontend
          io.emit("ndvi-data", ndviResult);

          // Inject NDVI into formatted data for the RL engine below
          formattedData.ndvi = ndviResult.score;
        }
      })
      .catch((err) => console.error("❌ NDVI Engine unhandled:", err.message))
      .finally(() => {
        // ── Step 10: RL Irrigation Optimizer — runs after NDVI is computed ──
        getRLIrrigationAction(formattedData)
          .then((rlResult) => {
            if (rlResult) {
              console.log(`🤖 [RL] Recommendation: ${rlResult.litres}L — ${rlResult.reasoning}`);
              io.emit("rl-action", rlResult);
            }
          })
          .catch((err) => console.error("❌ RL Engine unhandled:", err.message));
      });

  } catch (err) {
    console.error("❌ [MQTT] Message processing error:", err.message);
  }
});

// ─── Track mode/command changes from any source ───────────────
// When frontend sends MANUAL_ON / MANUAL_OFF / AUTO via HTTP → pump.controller.js
// publishes to MQTT_MOTOR. We intercept here to keep currentMode in sync.
mqttClient.on("message", (topic, message) => {
  if (topic === MQTT_MOTOR) {
    const cmd = message.toString().trim().toUpperCase();
    if (cmd === "AUTO") currentMode = "AUTO";
    if (cmd === "MANUAL_ON") { currentMode = "MANUAL"; pumpIsOn = true; }
    if (cmd === "MANUAL_OFF") { currentMode = "MANUAL"; pumpIsOn = false; }
    console.log(`🎛️  [MODE] Updated → mode=${currentMode} pumpIsOn=${pumpIsOn}`);
  }
});

// ─── Start HTTP Server ────────────────────────────────────────
const PORT = process.env.PORT || 5001;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Backend server running on port ${PORT}`);
  console.log(`   MongoDB  : ${process.env.MONGO_URI}`);
  console.log(`   MQTT     : ${MQTT_BROKER}`);
  console.log(`   Topic    : ${MQTT_TOPIC}\n`);
});
