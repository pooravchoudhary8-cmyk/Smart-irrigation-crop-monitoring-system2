
import mongoose from "mongoose";

const sensorSchema = new mongoose.Schema(
  {
    soil_moisture: Number,
    temperature: Number,
    humidity: Number,
    rainfall: Number,
    crop_stage: Number
  },
  { timestamps: true }
);

const Sensor = mongoose.model("Sensor", sensorSchema);

export default Sensor;
