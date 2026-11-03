from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field
import joblib


app = FastAPI(title="Breast Cancer Prediction")
app.add_middleware(CORSMiddleware,
                    allow_origins=["*"], 
                    allow_methods=["*"], 
                    allow_headers=["*"])

model = joblib.load("Breast_Cancer_Model.pkl")
preprocessor = model.named_steps["preprocessor"]
classifier = model.named_steps["classifier"]
FEATURES = list(model.feature_names_in_)
MAL_IDX = 1
SIGN = 1  


class InputData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    radius_mean: float
    texture_mean: float
    smoothness_mean: float
    compactness_mean: float
    symmetry_mean: float
    fractal_dimension_mean: float
    radius_se: float
    texture_se: float
    smoothness_se: float
    compactness_se: float
    concave_points_se: float = Field(..., alias="concave points_se")
    symmetry_se: float
    symmetry_worst: float
    fractal_dimension_worst: float


def risk_level(p: float) -> str:
    if p < 0.10: return "very_low"
    if p < 0.35: return "low"
    if p < 0.65: return "uncertain"
    if p < 0.90: return "high"
    return "very_high"

@app.get("/")
def home():
    return {"message": "Breast Cancer Classification API"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
def predict(data: InputData):
    input_dict = data.model_dump(by_alias=True)
    input_df = pd.DataFrame([input_dict])[FEATURES]

    pred = model.predict(input_df)[0]
    proba = model.predict_proba(input_df)[0]
    p_mal = float(proba[MAL_IDX])
    p_ben = 1.0 - p_mal

    # Per-feature push toward malignant (log-odds). Positive = raises risk.
    z = preprocessor.transform(input_df)[0]
    contrib = SIGN * classifier.coef_[0] * z
    factors = sorted(
        ({"key": k, "contribution": round(float(c), 3)} for k, c in zip(FEATURES, contrib)),
        key=lambda f: abs(f["contribution"]), reverse=True,
    )

    return {
        "result": "Malignant cancerous" if pred == 1 else "Benign Non cancerous",
        "prediction": str(pred),
        "probability_malignant": round(p_mal, 4),
        "probability_benign": round(p_ben, 4),
        "confidence": round(max(p_mal, p_ben), 4),
        "risk_level": risk_level(p_mal),
        "factors": factors,
        "model": "Logistic regression · 14 features",
    }