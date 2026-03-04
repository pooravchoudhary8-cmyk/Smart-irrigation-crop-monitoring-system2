export const formatSensorData = (data) => {
  return {
    soilMoisture: `${data.soil_moisture}%`,
    temperature: `${data.temperature} °C`,
    humidity: `${data.humidity}%`,
    rainfall: `${data.rainfall} mm`
  };
};
