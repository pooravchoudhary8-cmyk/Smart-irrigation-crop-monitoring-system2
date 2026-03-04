"""
predict.py
==========
Public interface for the trained RL irrigation agent.

Usage (standalone test):
    cd c:\\Users\\Poorav Choudhary\\Desktop\\cropy5\\rag
    python -c "
    from rl_irrigation.predict import get_irrigation_action
    print(get_irrigation_action(soil=25, temp=32, humidity=60, rain=0, crop_stage=2))
    "

Usage (inside rag_api.py):
    from rl_irrigation.predict import load_rl_model, get_irrigation_action
    rl_model = load_rl_model()   # called once at startup

    result = get_irrigation_action(
        soil=sensor.soil_moisture,
        temp=sensor.temperature,
        humidity=sensor.humidity,
        rain=1.0 if sensor.rain_detected else 0.0,
        crop_stage=2.0,          # vegetative stage as default
        model=rl_model,          # pass pre-loaded model
    )
"""

import os
import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# ── Action → Litres mapping ────────────────────────────────────────────────────
LITRES_MAP = {0: 0, 1: 10, 2: 20, 3: 30}

# Reasoning templates per action × soil_moisture condition
_REASONS = {
    0: {
        "rain":    "Rain detected — no irrigation needed, saving water",
        "wet":     "Soil well-hydrated ({soil:.0f}%) — withholding irrigation",
        "normal":  "Soil moisture adequate ({soil:.0f}%) — conservation mode",
        "default": "Minimal irrigation sufficient at current conditions",
    },
    1: {
        "rain":    "Light rain but soil slightly dry ({soil:.0f}%) — minimal top-up",
        "wet":     "Soil near optimal — small irrigation for precision management",
        "normal":  "Soil moisture moderate ({soil:.0f}%) — light irrigation recommended",
        "default": "10L irrigation to maintain soil health",
    },
    2: {
        "rain":    "Soil dry ({soil:.0f}%) despite rain — supplemental irrigation needed",
        "wet":     "Irrigation cycle maintaining optimal window",
        "normal":  "Soil drying ({soil:.0f}%) — moderate irrigation to prevent stress",
        "default": "20L irrigation for balanced soil moisture",
    },
    3: {
        "rain":    "Critically dry soil ({soil:.0f}%) — full irrigation despite rain",
        "wet":     "High crop-stage demand — full irrigation cycle initiated",
        "normal":  "Soil critically dry ({soil:.0f}%) — full 30L irrigation to prevent crop loss",
        "stressed": "Moderate Stress (NDVI: {ndvi}) — boosting irrigation for metabolic recovery",
        "diseased": "Poor / Diseased (NDVI: {ndvi}) — minimizing water to avoid pathogens while alerted",
        "default": "Full irrigation cycle required for crop survival",
    },
}


def _build_reason(action_idx: int, soil: float, rain: float, ndvi: float) -> str:
    """Return a human-readable reasoning string for the RL decision."""
    reasons = _REASONS.get(action_idx, {})
    if ndvi < 0.3:
        key = "diseased" if "diseased" in reasons else "default"
    elif ndvi < 0.5:
        key = "stressed" if "stressed" in reasons else "default"
    elif rain == 1.0:
        key = "rain"
    elif soil > 65:
        key = "wet"
    elif soil < 40:
        key = "normal"
    else:
        key = "default"

    template = reasons.get(key, reasons.get("default", "Irrigation decision made by RL agent"))
    return template.format(soil=soil, ndvi=ndvi)


def load_rl_model(model_path: str | None = None):
    """
    Load the trained PPO model once.  Returns the model object.
    Pass the returned object to get_irrigation_action() on each call.

    Falls back to a rule-based heuristic if the model file doesn't exist
    (useful during first run before training completes).
    """
    try:
        from stable_baselines3 import PPO

        if model_path is None:
            default = Path(__file__).parent / "models" / "ppo_irrigation.zip"
            # Prefer best_model.zip if EvalCallback saved one
            best   = Path(__file__).parent / "models" / "best_model.zip"
            model_path = str(best) if best.exists() else str(default)

        if not Path(model_path).exists():
            logger.warning(
                "⚠️  RL model not found at %s. "
                "Run `python -m rl_irrigation.train` to train. "
                "Falling back to heuristic mode.",
                model_path,
            )
            return None

        model = PPO.load(model_path)
        logger.info("✅ RL model loaded from %s", model_path)
        return model

    except ImportError:
        logger.error("stable-baselines3 not installed. Run: pip install stable-baselines3")
        return None
    except Exception as exc:
        logger.error("Failed to load RL model: %s", exc)
        return None


def _heuristic_action(soil: float, rain: float) -> int:
    """Simple rule-based fallback when the trained model isn't available."""
    if rain == 1.0:
        return 0       # never irrigate during rain
    if soil < 20:
        return 3       # critically dry → max irrigation
    if soil < 35:
        return 2       # dry → moderate
    if soil < 50:
        return 1       # slightly dry → light
    return 0           # adequate moisture → no irrigation


def get_irrigation_action(
    soil: float,
    temp: float,
    humidity: float,
    rain: float,
    crop_stage: float,
    ndvi: float = 0.5,
    model=None,
) -> dict:
    """
    Predict the optimal irrigation quantity for current sensor readings.

    Parameters
    ----------
    soil        : soil moisture %          (0 – 100)
    temp        : temperature °C           (0 – 50)
    humidity    : relative humidity %      (0 – 100)
    rain        : rain detected            (0.0 = no, 1.0 = yes)
    crop_stage  : crop growth stage        (0=seedling … 4=harvest)
    model       : pre-loaded SB3 PPO model (pass None to trigger model load)

    Returns
    -------
    dict:
        action_index : int   ∈ {0,1,2,3}
        litres       : int   ∈ {0,10,20,30}
        reasoning    : str
        confidence   : str   ∈ {"rl_model", "heuristic"}
        sensor_snapshot : dict
    """
    # Auto-load if caller didn't provide a pre-loaded model
    _model = model
    if _model is None:
        _model = load_rl_model()

    obs = np.array([[soil, temp, humidity, rain, crop_stage]], dtype=np.float32)

    if _model is not None:
        action_arr, _ = _model.predict(obs, deterministic=True)
        action_idx    = int(action_arr[0])
        confidence    = "rl_model"
    else:
        action_idx = _heuristic_action(soil, rain)
        confidence = "heuristic"

    litres   = LITRES_MAP[action_idx]
    # Research-grade Logic: Integrate NDVI into action selection
    # Stressed crops (0.3 < NDVI < 0.5) get a +1 boost to irrigation for recovery
    if 0.3 <= ndvi < 0.5 and action_idx < 3 and rain == 0:
        action_idx += 1
        litres = LITRES_MAP[action_idx]
    # Diseased/Poor crops (NDVI < 0.3) often require REDUCED water to prevent rot
    # unless soil is critically dry. Here we cap it at moderate (20L).
    elif ndvi < 0.3 and action_idx > 2:
        action_idx = 2
        litres = LITRES_MAP[action_idx]
        
    reasoning = _build_reason(action_idx, soil, rain, ndvi)

    return {
        "action_index": action_idx,
        "litres":       litres,
        "reasoning":    reasoning,
        "confidence":   confidence,
        "sensor_snapshot": {
            "soil_moisture": round(soil, 1),
            "temperature":   round(temp, 1),
            "humidity":      round(humidity, 1),
            "rain":          int(rain),
            "crop_stage":    round(crop_stage, 1),
            "ndvi":          round(ndvi, 2),
        },
    }
