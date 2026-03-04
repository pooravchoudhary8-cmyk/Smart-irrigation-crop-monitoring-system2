import mongoose from "mongoose";

const anomalySchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    description: { type: String },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low"
    }
  },
  { timestamps: true }
);

export const Anomaly = mongoose.model("Anomaly", anomalySchema);
