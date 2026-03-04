

import Sensor from "../models/sensor.model.js";

export const saveSensorData = async (req, res) => {
  try {
    const sensorData = new Sensor(req.body);

    await sensorData.save();

    res.status(201).json({
      message: "Sensor data saved successfully",
      data: sensorData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save sensor data" });
  }
};

export const getSensorData = async (req, res) => {
  try {
    // limit query (default = 20)
    const limit = parseInt(req.query.limit) || 20;

    console.log(`📊 Fetching sensor data with limit: ${limit}`);
    const data = await Sensor.find()
      .sort({ createdAt: -1 }) // newest first
      .limit(limit);

    console.log(`✅ Found ${data.length} sensor records`);
    if (data.length > 0) {
      console.log("📋 Latest record:", JSON.stringify(data[0], null, 2));
    }

    res.status(200).json({
      count: data.length,
      data
    });
  } catch (error) {
    console.error("❌ Error fetching sensor data:", error);
    res.status(500).json({ error: "Failed to fetch sensor data" });
  }
};
