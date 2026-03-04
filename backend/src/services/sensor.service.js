import { Sensor } from "../models/sensor.model.js";
import { backupToCSV } from "./backup.service.js";

export const saveSensorData = async (data) => {
  const record = await Sensor.create(data);

  // Backup for offline safety
  await backupToCSV(record);

  return record;
};
