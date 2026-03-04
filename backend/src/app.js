
import express from "express";
import cors from "cors";

// Import routes
import sensorRoutes from "./Routes/sensor.routes.js";
import manualRoutes from "./Routes/manual.routes.js";
import pumpRoutes from "./Routes/pump.routes.js";
import dashboardRoutes from "./Routes/dashboard.routes.js";
import authRoutes from "./Routes/auth.routes.js";
import chatRoutes from "./Routes/chat.routes.js";

import intelligenceRoutes from "./Routes/intelligence.routes.js";
import soilRoutes from "./Routes/soil.routes.js";
import ndviRoutes from "./Routes/ndvi.routes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "Backend is running", chatbot: "NewChatbot API" });
});

// API routes
app.use("/api", authRoutes);
app.use("/api", sensorRoutes);
app.use(manualRoutes);
app.use("/api", pumpRoutes);
app.use(dashboardRoutes);
app.use("/api", chatRoutes);

app.use("/api", intelligenceRoutes); // ← New AI Intelligence Engine endpoints
app.use("/api", soilRoutes);         // ← Soil Classification endpoints
app.use("/api", ndviRoutes);         // ← NDVI Satellite + Crop Health endpoints

export default app;
