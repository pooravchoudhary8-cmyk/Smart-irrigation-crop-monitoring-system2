import { writeCSVRow } from "../utilities/csvWriter.js";

export const backupToCSV = async (data) => {
  writeCSVRow("backup.csv", [
    new Date().toISOString(),
    data.soil_moisture,
    data.temperature,
    data.humidity,
    data.rainfall
  ]);
};
