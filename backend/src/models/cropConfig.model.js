import mongoose from "mongoose";

/**
 * Crop Configuration Schema
 * ─────────────────────────
 * Stores per-farm crop settings, growth stage thresholds,
 * and irrigation parameters used by the Intelligence Engine.
 */
const cropConfigSchema = new mongoose.Schema(
    {
        farm_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        crop_type: {
            type: String,
            required: true,
            default: "Wheat",
        },
        soil_type: {
            type: String,
            default: "Loamy",
        },
        growth_stage: {
            type: String,
            enum: [
                "germination",
                "seedling",
                "vegetative",
                "flowering",
                "fruiting",
                "maturity",
                "harvest",
            ],
            default: "vegetative",
        },
        planting_date: {
            type: Date,
            default: Date.now,
        },
        field_area_sqm: {
            type: Number,
            default: 1000,
        },
        coordinates: {
            lat: { type: Number, default: 28.6139 },
            lng: { type: Number, default: 77.209 },
        },
        // Crop-stage-specific soil moisture thresholds
        thresholds: {
            type: mongoose.Schema.Types.Mixed,
            default: {
                germination: { min: 60, max: 80, critical_low: 50 },
                seedling: { min: 55, max: 75, critical_low: 45 },
                vegetative: { min: 45, max: 70, critical_low: 35 },
                flowering: { min: 50, max: 75, critical_low: 40 },
                fruiting: { min: 45, max: 70, critical_low: 35 },
                maturity: { min: 35, max: 60, critical_low: 25 },
                harvest: { min: 20, max: 45, critical_low: 15 },
            },
        },
        sprinkler_flow_rate_lpm: {
            type: Number,
            default: 15,
        },
    },
    { timestamps: true }
);

const CropConfig = mongoose.model("CropConfig", cropConfigSchema);

export default CropConfig;
