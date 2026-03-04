export const buildFeatures = (sensorData) => {
  return {
    soil_moisture: sensorData.soil_moisture,
    temperature: sensorData.temperature,
    humidity: sensorData.humidity,
    rainfall: sensorData.rainfall,
    water_deficit: 100 - sensorData.soil_moisture
  };
};
