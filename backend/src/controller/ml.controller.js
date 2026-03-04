import { getYieldPrediction } from "../services/ml.service.js";

export const getPrediction = async (req, res) => {
  try {
    const { area, item, year, pesticides } = req.body;
    const prediction = await getYieldPrediction({ area, item, year, pesticides });

    res.json(prediction);
  } catch (error) {
    res.status(500).json({
      error: "ML prediction failed",
      message: error.message
    });
  }
};
