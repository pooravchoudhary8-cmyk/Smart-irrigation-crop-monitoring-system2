"""
Pydantic models for all Intelligence Engine endpoints
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ═══════════════════════════════════════════════════════════════
# MODULE 1: SENSOR CALIBRATION
# ═══════════════════════════════════════════════════════════════

class CalibrationRequest(BaseModel):
    """Farmer calibrates sensor by providing dry and wet soil readings"""
    sensor_id: str = Field(..., description="Unique sensor identifier (e.g. 'sensor_A1')")
    dry_value: float = Field(..., description="Raw ADC reading in completely dry soil")
    wet_value: float = Field(..., description="Raw ADC reading in fully saturated soil")
    sensor_type: str = Field(default="capacitive", description="Sensor type: capacitive, resistive")
    label: str = Field(default="", description="Human-friendly label like 'Zone A sensor'")


class CalibrationProfile(BaseModel):
    sensor_id: str
    dry_value: float
    wet_value: float
    sensor_type: str
    label: str
    calibrated_at: str
    is_inverted: bool = False  # Some sensors read high when dry


class ConvertRequest(BaseModel):
    """Convert a raw reading using a calibrated sensor profile"""
    sensor_id: str = Field(..., description="Sensor ID (must be calibrated first)")
    raw_value: float = Field(..., description="Raw ADC value from the sensor")


class ConvertResponse(BaseModel):
    sensor_id: str
    raw_value: float
    moisture_percent: float
    quality: str = ""  # "dry", "low", "optimal", "wet", "saturated"
    calibrated: bool = True
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# MODULE 2: ZONE-BASED INTELLIGENCE
# ═══════════════════════════════════════════════════════════════

class ZoneConfig(BaseModel):
    """Define a zone in the field"""
    zone_id: str = Field(..., description="Unique zone identifier")
    name: str = Field(default="", description="Human name like 'North Plot'")
    area_sqm: float = Field(default=1000, description="Zone area in square meters")
    sensor_id: Optional[str] = Field(default=None, description="Sensor assigned to this zone (if any)")
    crop_type: str = Field(default="Wheat")
    soil_type: str = Field(default="Loamy")
    position_x: float = Field(default=0, description="X position in field grid (meters)")
    position_y: float = Field(default=0, description="Y position in field grid (meters)")


class ZoneConfigureRequest(BaseModel):
    zones: list[ZoneConfig]


class SensorReading(BaseModel):
    sensor_id: str
    moisture_percent: float
    temperature: float = 25.0
    humidity: float = 50.0
    timestamp: str = ""


class ZoneEstimateRequest(BaseModel):
    """Provide readings from available sensors to estimate all zones"""
    readings: list[SensorReading]
    weather: Optional[dict] = None  # {"wind_speed": 5, "forecast_rain": false}


class ZoneMoisture(BaseModel):
    zone_id: str
    name: str
    estimated_moisture: float
    confidence: float
    source: str  # "sensor" or "interpolated"
    crop_type: str
    needs_irrigation: bool
    status: str  # "critical", "low", "optimal", "wet"


class ZoneMapResponse(BaseModel):
    zones: list[ZoneMoisture]
    coverage_score: float  # How well sensors cover the field (0-100)
    timestamp: str


# ═══════════════════════════════════════════════════════════════
# MODULE 3: IRRIGATION RECOMMENDATION ENGINE
# ═══════════════════════════════════════════════════════════════

class IrrigationRecommendRequest(BaseModel):
    zone_id: str = Field(default="default")
    current_moisture: float = Field(..., description="Current soil moisture %")
    temperature: float = Field(default=30.0)
    humidity: float = Field(default=50.0)
    wind_speed: float = Field(default=5.0, description="Wind speed in km/h")
    crop_type: str = Field(default="Wheat")
    soil_type: str = Field(default="Loamy")
    crop_stage: str = Field(default="vegetative", description="seedling, vegetative, flowering, maturity")
    sprinkler_flow_rate: float = Field(default=15.0, description="Sprinkler flow rate in liters/minute")
    field_area_sqm: float = Field(default=1000.0, description="Field area in sq meters")
    last_irrigation_hours_ago: float = Field(default=24.0)


class IrrigationRecommendation(BaseModel):
    should_irrigate: bool
    urgency: str  # "none", "low", "medium", "high", "critical"
    water_needed_liters: float
    sprinkler_runtime_minutes: float
    next_irrigation_in_hours: float
    message: str  # Human-readable like "Irrigate after 2 days"
    daily_water_loss_percent: float  # ET-based daily moisture loss
    reasoning: list[str]
    error: Optional[str] = None


class ScheduleEntry(BaseModel):
    zone_id: str
    zone_name: str
    next_irrigation: str  # datetime string
    hours_remaining: float
    urgency: str
    water_needed_liters: float
    sprinkler_runtime_minutes: float


class ScheduleResponse(BaseModel):
    schedule: list[ScheduleEntry]
    generated_at: str


# ═══════════════════════════════════════════════════════════════
# MODULE 4: WATER SAVINGS ANALYTICS
# ═══════════════════════════════════════════════════════════════

class IrrigationLogEntry(BaseModel):
    zone_id: str = Field(default="default")
    duration_minutes: float = Field(..., description="How long the sprinkler ran")
    liters_used: float = Field(default=0, description="If 0, calculated from duration * flow_rate")
    flow_rate_lpm: float = Field(default=15.0, description="Liters per minute")
    method: str = Field(default="sprinkler", description="sprinkler, drip, flood")
    timestamp: str = Field(default="")


class WaterSummary(BaseModel):
    total_water_used_liters: float
    flood_equivalent_liters: float  # How much flood irrigation would have used
    water_saved_liters: float
    saving_percent: float
    cost_saved_inr: float  # Estimated cost savings in INR
    total_irrigations: int
    avg_per_irrigation_liters: float
    period_days: int
    zones_breakdown: list[dict]
    message: str  # "You saved 38% water this season!"


class WaterTrend(BaseModel):
    daily: list[dict]  # [{"date": "2026-02-20", "liters": 150, "irrigations": 2}]
    weekly_avg_liters: float
    trend_direction: str  # "decreasing", "stable", "increasing"
    message: str


# ═══════════════════════════════════════════════════════════════
# MODULE 5: FAILURE & ANOMALY DETECTION
# ═══════════════════════════════════════════════════════════════

class SensorDataPoint(BaseModel):
    sensor_id: str
    moisture: float
    temperature: float = 0
    humidity: float = 0
    timestamp: str = ""


class FailureAnalyzeRequest(BaseModel):
    """Send recent sensor readings for anomaly detection"""
    readings: list[SensorDataPoint]
    motor_was_on: bool = Field(default=False, description="Was motor running during this period?")
    irrigation_happened: bool = Field(default=False, description="Was irrigation performed recently?")


class FailureAlert(BaseModel):
    alert_id: str
    type: str  # "sensor_drift", "pipe_leak", "motor_fault", "sensor_spike", "sensor_dead"
    severity: str  # "low", "medium", "high"
    sensor_id: str
    description: str
    detected_at: str
    resolved: bool = False


class FailureAnalyzeResponse(BaseModel):
    alerts: list[FailureAlert]
    system_health: str  # "healthy", "warning", "critical"
    health_score: float  # 0-100
    message: str
