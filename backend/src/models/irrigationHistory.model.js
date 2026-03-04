import mongoose from "mongoose";

/**
 * Irrigation History Schema
 * ─────────────────────────
 * Logs every irrigation event for water analytics,
 * anomaly detection, and drying-rate prediction.
 */
const irrigationHistorySchema = new mongoose.Schema(
    {
        farm_id: {
            type: String,
            required: true,
            index: true,
        },
        action: {
            type: String,
            enum: ["START", "STOP", "AUTO_ON", "AUTO_OFF"],
            required: true,
        },
        trigger: {
            type: String,
            enum: ["auto", "manual", "intelligence_engine", "scheduled"],
            default: "auto",
        },
        duration_minutes: Number,
        liters_used: Number,
        moisture_before: Number,
        moisture_after: Number,
        decision_context: {
            type: mongoose.Schema.Types.Mixed, // Stores the engine decision snapshot
        },
    },
    { timestamps: true }
);

irrigationHistorySchema.index({ farm_id: 1, createdAt: -1 });

const IrrigationHistory = mongoose.model(
    "IrrigationHistory",
    irrigationHistorySchema
);

export default IrrigationHistory;
