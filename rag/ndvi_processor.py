"""
ndvi_processor.py — Advanced NDVI Computation & Classification
=============================================================
Formula: NDVI = (NIR - RED) / (NIR + RED)

Classification:
  - Healthy          (> 0.5)
  - Moderate Stress  (0.3 to 0.5)
  - Poor / Diseased  (< 0.3)
"""

class NDVIProcessor:
    def __init__(self):
        pass

    def compute_ndvi(self, red: float, nir: float) -> float:
        """
        Computes NDVI from Red and Near-Infrared bands.
        Handles division by zero.
        """
        denominator = nir + red
        if denominator == 0:
            return 0.0
        
        ndvi = (nir - red) / denominator
        # Clip to [-1.0, 1.0]
        return max(-1.0, min(1.0, ndvi))

    def classify_health(self, ndvi: float) -> str:
        """
        Classifies crop health based on NDVI score.
        """
        if ndvi > 0.5:
            return "Healthy"
        elif ndvi >= 0.3:
            return "Moderate Stress"
        else:
            return "Poor / Diseased"

    def simulate_bands(self, soil_moisture: float) -> dict:
        """
        Simulates Red and NIR band values based on soil moisture for demonstration.
        Lower moisture -> Stressed -> Higher Red, Lower NIR.
        """
        # Base NIR: 0.8 (healthy), Base Red: 0.1 (healthy)
        # Stressed NIR: 0.4 (stressed), Stressed Red: 0.3 (stressed)
        
        if soil_moisture > 60:
            nir = 0.85
            red = 0.08
        elif soil_moisture > 30:
            nir = 0.65
            red = 0.15
        else:
            nir = 0.42
            red = 0.28
            
        return {"red": red, "nir": nir}

# Create a singleton instance
ndvi_engine = NDVIProcessor()
