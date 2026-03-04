import pandas as pd
import numpy as np
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import kagglehub
from kagglehub import load_dataset, KaggleDatasetAdapter

def generate_assets():
    print("🚀 Downloading dataset from Kaggle...")
    df = load_dataset(
        KaggleDatasetAdapter.PANDAS,
        "chaitanyagopidesi/smart-agriculture-dataset",
        "cropdata_updated.csv"
    )

    print("📊 Preprocessing data...")
    # Filter for Wheat and Potato
    df = df[df["crop ID"].isin(['Wheat', 'Potato'])]
    
    # Remove result == 2 (if any)
    df = df[df["result"] != 2]

    # Categorical encoding (drop_first=True)
    cat_cols = ["crop ID", "soil_type", "Seedling Stage"]
    for col in cat_cols:
        df[col] = df[col].astype("category")
    
    df_encoded = pd.get_dummies(df, columns=cat_cols, drop_first=True)

    # Features and Target
    X = df_encoded.drop(["result"], axis=1)
    y = df_encoded["result"]

    # Numeric scaling
    numeric_cols = ["MOI", "temp", "humidity"]
    scaler = StandardScaler()
    X[numeric_cols] = scaler.fit_transform(X[numeric_cols])

    print("🧠 Training Random Forest Classifier...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    rf_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_classifier.fit(X_train, y_train)

    print(f"✅ Model Accuracy: {rf_classifier.score(X_test, y_test):.4f}")

    # Save assets correctly
    print("💾 Saving assets...")
    with open('irrigation_model_3.0.pkl', 'wb') as f:
        pickle.dump(rf_classifier, f)
    
    with open('scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)

    print("✨ Assets generated successfully: irrigation_model_3.0.pkl, scaler.pkl")

if __name__ == "__main__":
    generate_assets()
