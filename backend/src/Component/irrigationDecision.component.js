export const irrigationDecision = ({
  soilMoisture,
  cropStage,
  thresholds
}) => {
  const threshold = thresholds[cropStage] || 30;

  return {
    irrigation_required: soilMoisture < threshold,
    reason:
      soilMoisture < threshold
        ? "Soil moisture below safe level"
        : "Soil moisture sufficient"
  };
};
