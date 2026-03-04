import mongoose from "mongoose";

/**
 * NDVI History Schema
 * ───────────────────
 * Stores satellite-derived NDVI readings for each farm.
 * One document per farm per satellite pass (deduped by revisit window).
 */
const ndviSchema = new mongoose.Schema(
    {
        farm_id: {
            type: String,
            required: true,
            index: true,
        },
        coordinates: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
        },
        ndvi_value: {
            type: Number,
            required: true,
            min: -1,
            max: 1,
        },
        crop_health_status: {
            type: String,
            enum: ["Poor", "Moderate", "Healthy"],
            required: true,
        },
        irrigation_recommendation: {
            type: String,
            required: true,
        },
        irrigation_priority: {
            type: String,
            enum: ["HIGH", "NORMAL", "LOW"],
            required: true,
        },
        source: {
            type: String,
            enum: ["sentinel_hub", "computed", "fallback"],
            default: "sentinel_hub",
        },
        band_data: {
            nir: Number,
            red: Number,
        },
        raw_response: {
            type: mongoose.Schema.Types.Mixed,
        },
    },
    {
        timestamps: true, // createdAt = fetch time, updatedAt = last modification
    }
);

// Compound index: fast lookup by farm + time for cache checks
ndviSchema.index({ farm_id: 1, createdAt: -1 });

const NdviHistory = mongoose.model("NdviHistory", ndviSchema);

export default NdviHistory;
