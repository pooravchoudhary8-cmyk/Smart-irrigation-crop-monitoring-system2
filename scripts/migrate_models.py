import shutil
import os

src_dir = r"c:\Users\Poorav Choudhary\Desktop\irrgation and yield prediction models original\irrgation and yield model predictor"
dst_dir = r"c:\Users\Poorav Choudhary\Desktop\cropy5\rag"

files = [
    "irrigation_model_3.0.pkl",
    "scaler_irrigation.pkl",
    "crop_yield_model.pkl",
    "scaler_yield.pkl"
]

print(f"Starting migration from {src_dir} to {dst_dir}")

for f in files:
    src_path = os.path.join(src_dir, f)
    dst_path = os.path.join(dst_dir, f)
    if os.path.exists(src_path):
        try:
            shutil.copy(src_path, dst_path)
            print(f"✅ Success: Copied {f}")
        except Exception as e:
            print(f"❌ Error copying {f}: {str(e)}")
    else:
        print(f"❌ Error: Source file not found: {src_path}")

print(f"Final destination contents: {os.listdir(dst_dir)}")
