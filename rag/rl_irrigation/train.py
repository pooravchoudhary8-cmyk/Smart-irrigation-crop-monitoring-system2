"""
train.py
========
Train a PPO agent on IrrigationEnv using Stable-Baselines3.

Usage:
    cd c:\\Users\\Poorav Choudhary\\Desktop\\cropy5\\rag
    python -m rl_irrigation.train

Output:
    rl_irrigation/models/ppo_irrigation.zip   ← trained model
    rl_irrigation/models/ppo_irrigation_logs/ ← TensorBoard logs (optional)

Training is intentionally lightweight (50,000 steps) so it completes
in < 60 seconds on a low-resource laptop — suitable for hackathon demos.
Increase TOTAL_TIMESTEPS for a more optimised agent in production.
"""

import os
import sys
from pathlib import Path

# ── Make sure the rl_irrigation package is importable ──────────────────────────
ROOT = Path(__file__).resolve().parent.parent   # cropy5/rag/
sys.path.insert(0, str(ROOT))

from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback

from rl_irrigation.environment import IrrigationEnv

# ── Config ─────────────────────────────────────────────────────────────────────
TOTAL_TIMESTEPS = 50_000      # 1 minute training
N_ENVS          = 4           # parallel envs for faster collection
SAVE_DIR        = ROOT / "rl_irrigation" / "models"
MODEL_NAME      = "ppo_irrigation"
LOG_DIR         = SAVE_DIR / f"{MODEL_NAME}_logs"

SAVE_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)


def train():
    print("=" * 60)
    print("  🌾 RL Irrigation Agent — PPO Training")
    print("=" * 60)
    print(f"  Timesteps : {TOTAL_TIMESTEPS:,}")
    print(f"  Parallel  : {N_ENVS} envs")
    print(f"  Save path : {SAVE_DIR / MODEL_NAME}.zip")
    print("=" * 60)

    # ── Vectorised training environments ───────────────────────────────────
    env = make_vec_env(IrrigationEnv, n_envs=N_ENVS)

    # ── Evaluation environment (single env, no vec) ─────────────────────────
    eval_env = make_vec_env(IrrigationEnv, n_envs=1)

    # ── Callbacks ──────────────────────────────────────────────────────────
    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=str(SAVE_DIR),
        eval_freq=5_000,
        n_eval_episodes=10,
        verbose=1,
    )

    # ── PPO Agent ──────────────────────────────────────────────────────────
    model = PPO(
        policy="MlpPolicy",
        env=env,
        learning_rate=3e-4,
        n_steps=512,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,         # encourage exploration
        verbose=1,
    )

    # ── Train ──────────────────────────────────────────────────────────────
    model.learn(
        total_timesteps=TOTAL_TIMESTEPS,
        callback=eval_callback,
        progress_bar=True,
    )

    # ── Save final model ───────────────────────────────────────────────────
    final_path = str(SAVE_DIR / MODEL_NAME)
    model.save(final_path)
    print(f"\n✅ Training complete!  Model saved → {final_path}.zip")

    # Quick sanity check
    _quick_test(final_path)


def _quick_test(model_path: str):
    """Load the saved model and run a short episode to verify it works."""
    print("\n🧪 Running quick verification episode...")
    from stable_baselines3 import PPO as _PPO
    m = _PPO.load(model_path)

    env = IrrigationEnv(render_mode=None)
    obs, _ = env.reset()

    total_reward = 0.0
    for step in range(10):
        action, _ = m.predict(obs, deterministic=True)
        obs, reward, done, _, info = env.step(int(action))
        total_reward += reward
        litres = info["litres"]
        soil   = info["soil_moisture"]
        print(f"  step {step+1:2d}: action={litres}L  soil={soil:.1f}%  reward={reward:+.2f}")
        if done:
            break

    print(f"  Total reward over 10 steps: {total_reward:+.2f}")
    print("✅ Verification passed!\n")


if __name__ == "__main__":
    train()
