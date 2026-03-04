"""
environment.py
==============
Custom Gymnasium environment that simulates farm soil-moisture dynamics.

State space  (5 continuous values, all normalised to [0, 1]):
    [soil_moisture%, temperature°C, humidity%, rain(0/1), crop_stage(0-4)]

Action space (Discrete, 4 choices):
    0 → 0 L   (do not irrigate)
    1 → 10 L
    2 → 20 L
    3 → 30 L

Reward function:
    +2.0  if soil in optimal [40, 70]%
    -0.1 × litres_applied           (water cost)
    -3.0  if soil > 80%             (over-irrigation)
    -2.0  if soil < 20%             (crop stress)
    -1.5  if rain & irrigating (> 0 L)   (waste)
    +0.5  crop_stage bonus scaling  (more reward near harvest)
"""

import numpy as np
import gymnasium as gym
from gymnasium import spaces


LITRES_MAP = {0: 0, 1: 10, 2: 20, 3: 30}

# Optimal soil moisture window
MOISTURE_LOW  = 40.0   # below this → stress
MOISTURE_HIGH = 70.0   # above this → saturation


class IrrigationEnv(gym.Env):
    """
    Single-field irrigation simulation environment.

    Every step = one irrigation decision cycle (e.g. 15-minute window).
    Episode ends after MAX_STEPS cycles.
    """

    metadata = {"render_modes": ["human"]}

    MAX_STEPS = 200

    # ── Observation bounds ──────────────────────────────────────────────────
    OBS_LOW  = np.array([0.0,   0.0,  0.0, 0.0, 0.0], dtype=np.float32)
    OBS_HIGH = np.array([100.0, 50.0, 100.0, 1.0, 4.0], dtype=np.float32)

    def __init__(self, render_mode=None):
        super().__init__()
        self.render_mode = render_mode

        self.observation_space = spaces.Box(
            low=self.OBS_LOW,
            high=self.OBS_HIGH,
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(4)  # 0 / 10 / 20 / 30 L

        self._state: np.ndarray = None
        self._step_count: int = 0

    # ── Internal helpers ────────────────────────────────────────────────────

    def _random_initial_state(self) -> np.ndarray:
        """Random but plausible starting conditions."""
        soil_moisture = np.random.uniform(15, 85)   # %
        temperature   = np.random.uniform(20, 45)   # °C
        humidity      = np.random.uniform(30, 90)   # %
        rain          = float(np.random.random() < 0.15)   # 15 % chance of rain
        crop_stage    = np.random.uniform(0, 4)     # 0=seedling … 4=harvest

        return np.array(
            [soil_moisture, temperature, humidity, rain, crop_stage],
            dtype=np.float32,
        )

    def _step_dynamics(self, state: np.ndarray, litres: float) -> np.ndarray:
        """
        Simplified soil-moisture dynamics for one time step.

        Moisture change:
          + irrigation effect  : litres × 0.4          (absorption %)
          − evapotranspiration : 0.6 × (temp / 40)     (heat-driven)
          − rain absorption    : rain × 3               (natural bonus reduces dryness)
          + rain fallout       : rain × 2               (soil gets wetter from rainfall)
        """
        soil_moisture, temperature, humidity, rain, crop_stage = state

        # Evapotranspiration (increases with temp, decreases with humidity)
        et = 0.6 * (temperature / 40.0) * (1.0 - humidity / 200.0)

        # Irrigation effect
        irrigation_gain = litres * 0.4

        # Natural rain moisture gain
        rain_gain = rain * 5.0

        new_moisture = soil_moisture + irrigation_gain + rain_gain - et
        new_moisture = float(np.clip(new_moisture, 0.0, 100.0))

        # Temperature & humidity drift (small random walk)
        new_temp = float(np.clip(temperature + np.random.uniform(-0.5, 0.5), 20, 45))
        new_hum  = float(np.clip(humidity    + np.random.uniform(-1.0, 1.0), 20, 95))

        # Rain clears stochastically (80 % chance to stop each step)
        new_rain = 0.0 if (rain and np.random.random() < 0.80) else rain
        # Small chance of rain starting
        if new_rain == 0.0 and np.random.random() < 0.05:
            new_rain = 1.0

        # Crop stage advances very slowly
        new_crop_stage = float(np.clip(crop_stage + 0.005, 0.0, 4.0))

        return np.array(
            [new_moisture, new_temp, new_hum, new_rain, new_crop_stage],
            dtype=np.float32,
        )

    def _compute_reward(self, state: np.ndarray, litres: float) -> float:
        soil_moisture = state[0]
        rain          = state[3]
        crop_stage    = state[4]

        reward = 0.0

        # ── Soil moisture quality ──────────────────────────────────────────
        if MOISTURE_LOW <= soil_moisture <= MOISTURE_HIGH:
            reward += 2.0
        elif soil_moisture < 20.0:
            reward -= 2.0   # crop stress
        elif soil_moisture > 80.0:
            reward -= 3.0   # over-saturation / root rot

        # ── Water usage cost (minimise) ────────────────────────────────────
        reward -= 0.1 * litres

        # ── Penalise irrigating during rain ───────────────────────────────
        if rain == 1.0 and litres > 0:
            reward -= 1.5

        # ── Crop stage bonus (farmer cares more near harvest) ─────────────
        stage_bonus = 0.1 * crop_stage
        if MOISTURE_LOW <= soil_moisture <= MOISTURE_HIGH:
            reward += stage_bonus

        return float(reward)

    # ── Gymnasium API ────────────────────────────────────────────────────────

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._state = self._random_initial_state()
        self._step_count = 0
        info = {}
        return self._state.copy(), info

    def step(self, action: int):
        litres = LITRES_MAP[int(action)]

        reward = self._compute_reward(self._state, litres)
        self._state = self._step_dynamics(self._state, litres)
        self._step_count += 1

        terminated = self._step_count >= self.MAX_STEPS
        truncated  = False
        info       = {
            "litres": litres,
            "soil_moisture": float(self._state[0]),
        }

        return self._state.copy(), reward, terminated, truncated, info

    def render(self):
        if self.render_mode == "human":
            s = self._state
            print(
                f"Step {self._step_count:3d} | "
                f"Soil: {s[0]:5.1f}% | Temp: {s[1]:4.1f}°C | "
                f"Humidity: {s[2]:4.1f}% | Rain: {int(s[3])} | Stage: {s[4]:.1f}"
            )
