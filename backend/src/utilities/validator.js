export const validateSensorData = (data) => {
  if (
    data.soil_moisture < 0 ||
    data.soil_moisture > 100
  ) {
    throw new Error("Invalid soil moisture value");
  }

  if (data.temperature < -10 || data.temperature > 70) {
    throw new Error("Invalid temperature value");
  }

  return true;
};
