import mongoose from "mongoose";

const manualSchema = new mongoose.Schema(
  {
    irrigation_done: { type: Boolean, required: true },
    notes: { type: String },
    entered_by: { type: String, default: "farmer" }
  },
  { timestamps: true }
);

export const ManualEntry = mongoose.model(
  "ManualEntry",
  manualSchema
);

