import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    irrigation_required: { type: Boolean, required: true },
    predicted_dry_days: { type: Number },
    confidence: { type: Number }, // optional
    source: {
      type: String,
      enum: ["ml", "rule"],
      default: "ml"
    }
  },
  { timestamps: true }
);

export const Prediction = mongoose.model(
  "Prediction",
  predictionSchema
);
