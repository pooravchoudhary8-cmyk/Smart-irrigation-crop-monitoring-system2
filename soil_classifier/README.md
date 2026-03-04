# 🌍 Soil Classification Model — Developer Handoff

This document contains everything your team needs to **create FastAPI endpoints** for the trained soil classification model and **integrate it into the website**.

---

## 📦 Model Files

After running the notebook (`dm-2-novelty.ipynb`), two files are generated:

| File | Description |
|------|-------------|
| `soil_classification_model.h5` | Trained Keras model (VGG16 transfer learning) |
| `soil_labels.json` | JSON array of class labels |

---

## 📊 Model Specifications

| Property | Value |
|----------|-------|
| Architecture | VGG16 (ImageNet pretrained) + Dense layers |
| Input Shape | `(150, 150, 3)` — RGB image, 150×150 pixels |
| Output | 6-class softmax (probability for each soil type) |
| Training Accuracy | ~89% |
| Validation Accuracy | ~90.7% |
| Framework | TensorFlow / Keras |

### Soil Classes (in order)

```json
["Alluvial soil", "Black Soil", "Clay soil", "Red soil", "Sandy soil", "Loamy soil"]
```

The output softmax probabilities follow this exact order.

---

## 🔧 How to Load and Use the Model

### Dependencies Required

```
tensorflow
numpy
Pillow
```

### Loading the Model

```python
import tensorflow as tf
import json
import numpy as np
from PIL import Image

# Load model and labels
model = tf.keras.models.load_model("soil_classification_model.h5")

with open("soil_labels.json", "r") as f:
    labels = json.load(f)
# labels = ["Alluvial soil", "Black Soil", "Clay soil", "Red soil", "Sandy soil", "Loamy soil"]
```

### Image Preprocessing (MUST follow exactly)

Every input image must be preprocessed like this before passing to the model:

```python
IMAGE_SIZE = 150

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    1. Open image and convert to RGB
    2. Resize to 150x150
    3. Normalize pixel values to [0, 1] by dividing by 255
    4. Add batch dimension → shape becomes (1, 150, 150, 3)
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMAGE_SIZE, IMAGE_SIZE))
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array
```

> ⚠️ **Important**: The model was trained with `ImageDataGenerator(rescale=1./255)`, so you **must** divide by 255. Skipping this will give garbage predictions.

### Running Prediction

```python
# After preprocessing:
predictions = model.predict(img_array, verbose=0)  # shape: (1, 6)
probabilities = predictions[0]                       # shape: (6,)

predicted_index = int(np.argmax(probabilities))
predicted_label = labels[predicted_index]
confidence = float(probabilities[predicted_index])

print(f"Prediction: {predicted_label}")
print(f"Confidence: {confidence * 100:.1f}%")
```

---

## 🚀 Endpoints to Create (FastAPI)

### Required Dependencies

```
fastapi
uvicorn[standard]
tensorflow==2.10
numpy==1.23.5
Pillow
python-multipart   # needed for file uploads in FastAPI
```

### Endpoint 1: `POST /soil/predict`

**Purpose**: Accept an image upload and return soil classification result.

**Input**: Multipart form file upload (JPEG, PNG, or WEBP image)

**Expected Response Format**:
```json
{
  "prediction": "Red soil",
  "confidence": 0.9432,
  "probabilities": {
    "Alluvial soil": 0.0102,
    "Black Soil": 0.0051,
    "Clay soil": 0.0234,
    "Red soil": 0.9432,
    "Sandy soil": 0.0098,
    "Loamy soil": 0.0083
  }
}
```

**Logic**:
1. Read uploaded file bytes
2. Validate file type (only allow image/jpeg, image/png, image/webp)
3. Call `preprocess_image(image_bytes)` as shown above
4. Run `model.predict()` on the preprocessed array
5. Map the 6 output probabilities to the label names
6. Return the top prediction, its confidence, and all probabilities

### Endpoint 2: `GET /soil/labels`

**Purpose**: Return the list of soil types the model can classify.

**Expected Response**:
```json
{
  "labels": ["Alluvial soil", "Black Soil", "Clay soil", "Red soil", "Sandy soil", "Loamy soil"],
  "count": 6
}
```

---

## 🌐 Website Integration

### CORS

The FastAPI app **must** enable CORS so the frontend can call it:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with actual frontend URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Frontend API Call (JavaScript)

The website team should use this pattern to call the predict endpoint:

```javascript
const API_URL = "http://localhost:8001";  // change to production URL

async function classifySoil(imageFile) {
  const formData = new FormData();
  formData.append("file", imageFile);

  const response = await fetch(`${API_URL}/soil/predict`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  // data.prediction   → "Red soil"
  // data.confidence   → 0.9432
  // data.probabilities → { "Alluvial soil": 0.01, ... }
  return data;
}

// Usage with a file input:
document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const result = await classifySoil(file);
  console.log("Predicted:", result.prediction, result.confidence);
});
```

### React Example

```jsx
const classifySoil = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("http://localhost:8001/soil/predict", {
    method: "POST",
    body: formData,
  });

  return await res.json();
};
```

---

## ⚠️ Important Notes

1. **Model lazy loading**: Load the model once at server startup (or on first request), not on every request. It takes a few seconds to load.
2. **Image size**: Always resize to **150×150**. Other sizes will crash or give wrong results.
3. **Normalization**: Always divide pixel values by **255.0**. This is critical.
4. **File upload**: Use `python-multipart` package — FastAPI needs it for `UploadFile` to work.
5. **GPU optional**: The model runs fine on CPU for single-image inference. No GPU needed for the API server.
6. **Model file size**: The `.h5` file is ~75MB. Do not commit it to Git — use `.gitignore` and share it separately.
