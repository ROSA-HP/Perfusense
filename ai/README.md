# PerfuSense AI (posture model)

Python / TensorFlow work for the posture model. Status: **trained and served by a local FastAPI service, tested only on public hospital-mat data, not connected to the Express server.** Full method, code and results: [`docs/AI_TRAINING_REPORT.md`](../docs/AI_TRAINING_REPORT.md).

| File | What it is |
|---|---|
| `notebooks/01_posture_transformer.ipynb` | Lesson 1: first dataset, split by person, a Transformer from scratch |
| `notebooks/02_popu_and_combining.ipynb` | Lesson 2: PoPu, the mirror problem, the empty rule, combining mats |
| `notebooks/03_patch_30cm.ipynb` | Lesson 3: what our 30×30 cm mat really sees |
| `notebooks/04_movement_and_turns.ipynb` | Lesson 4: rebuilt sessions, real turns, turn events |
| `notebooks/05_synthetic_pretraining.ipynb` | Lesson 5: pre-training on BodyPressureSD |
| `notebooks/06_final_model_and_service.ipynb` | Lesson 6: fair comparison, final model, service |
| `perfusense_ai/data.py`, `model.py` | shared code; training and serving must use the same functions |
| `serve.py` | the FastAPI service |

## Setup (Windows)

Needs [uv](https://docs.astral.sh/uv/) (or plain `python -m venv` with Python 3.12).

```bash
cd ai
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -r requirements.txt
```

In VS Code, open a notebook and pick the kernel "PerfuSense AI (.venv)", or `ai/.venv` under "Python Environments".

Each notebook runs on its own. Lesson 6 needs all three datasets, takes about 15 minutes on a laptop CPU, and writes `models/posture.keras` and `models/posture.json` (not in git).

## Run the service

```bash
cd ai
.venv/Scripts/python.exe -m uvicorn serve:app --port 8000
```

Send `POST /predict` with `{"frames": [...]}`: 30 frames, 100 mat bytes each. `http://localhost:8000/docs` has a test page. `EMPTY_MAX_MEAN_BYTE` sets the empty rule. Its default is a placeholder until it is measured on our mat.

## Data

Datasets are **not** in git (size and licences). Unzip them next to the repo:

```
D:\Projects\Perfusense\
  repo\                      (this repository)
  datasets\
    pmd-1.0.0\a-pressure-map-dataset-for-in-bed-posture-classification-1.0.0\experiment-i\...
    PoPu-main\PoPu-main\PoPu_data\...   (unzip PoPu_data_no_segments.zip inside)
    BodyPressureSD\synth\train_slp_{lay,lside,rside}_{f,m}_71to80_*.p
```

Elsewhere, set the environment variable `PERFUSENSE_DATA` to your `datasets` folder.

| Dataset | Licence |
|---|---|
| PmatData (PhysioNet) | ODC-By 1.0: cite it |
| PoPu | README says CC0; cite it |
| BodyPressureSD (Harvard Dataverse, doi:10.7910/DVN/C6J1SP, 6 files, 557 MB) | CC BY-SA 4.0 + **non-commercial academic or non-profit research only**: cite it |

The `SLP-Dataset-and-Code-master.zip` and `bodies-at-rest-master.zip` downloads hold code only. Their data was not used.
