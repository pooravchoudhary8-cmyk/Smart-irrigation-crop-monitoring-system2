import Sensor from "../models/sensor.model.js";

export const getDashboardData = async (req, res) => {
  try {
    const latestSensor = await Sensor.findOne().sort({ createdAt: -1 });

    res.json({
      latest_sensor: latestSensor,
      alerts: []
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch dashboard data"
    });
  }
};
