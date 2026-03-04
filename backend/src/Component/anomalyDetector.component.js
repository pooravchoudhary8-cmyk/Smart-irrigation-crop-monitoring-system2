export const detectAnomaly = ({
  soilMoisture,
  temperature
}) => {
  if (soilMoisture < 0 || soilMoisture > 100) {
    return { anomaly: true, reason: "Invalid soil moisture" };
  }

  if (temperature > 70) {
    return { anomaly: true, reason: "Extreme temperature" };
  }

  return { anomaly: false };
};
