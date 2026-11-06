"""Posture service: the PerfuSense server sends the last 30 frames, this answers with the posture.

Run from the ai folder:   .venv/Scripts/python.exe -m uvicorn serve:app --port 8000

Research prototype, not a medical device. The model has never been tested on our own mat.
"""
import json
import os
from pathlib import Path

import keras
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from perfusense_ai import data
from perfusense_ai import model as _layers  # noqa: F401  (registers our custom layers with Keras)

MODEL_DIR = Path(os.environ.get("PERFUSENSE_MODEL_DIR", Path(__file__).parent / "models"))

# PLACEHOLDER: below this average byte per cell, the mat counts as empty. It must be measured on our
# own mat. It is not a clinical value. We use the average because one stuck cell can fool a maximum.
EMPTY_MAX_MEAN_BYTE = float(os.environ.get("EMPTY_MAX_MEAN_BYTE", 2))

model = keras.models.load_model(MODEL_DIR / "posture.keras")
meta = json.loads((MODEL_DIR / "posture.json").read_text())

app = FastAPI(title="PerfuSense posture service")


class Window(BaseModel):
    frames: list[list[float]]   # 30 frames at 1 Hz, 100 mat bytes each (0-255), row-major, as the server stores them


@app.get("/health")
def health():
    return {"ok": True, "model": meta["name"], "classes": meta["classes"], "tested_on_our_mat": False}


@app.post("/predict")
def predict(window: Window):
    t, n = meta["t"], meta["grid"]
    if len(window.frames) != t or any(len(f) != n * n for f in window.frames):
        raise HTTPException(status_code=422, detail=f"expected {t} frames of {n * n} values")
    x = np.array(window.frames, dtype="float32").reshape(t, n, n)
    if float(x[-5:].mean()) < EMPTY_MAX_MEAN_BYTE:   # the rule runs first: scaling would blow up noise
        return {"posture": "empty", "confidence": 1.0, "probabilities": {"empty": 1.0}}
    logits = model.predict(data.normalise_window(data.mat_to_model(x))[None], verbose=0)[0]
    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    best = int(np.argmax(probs))
    return {"posture": meta["classes"][best], "confidence": round(float(probs[best]), 3),
            "probabilities": {c: round(float(p), 3) for c, p in zip(meta["classes"], probs)}}
