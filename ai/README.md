# PerfuSense AI (posture model)

Python / TensorFlow work for the posture model described in `PERFUSENSE_GUIDE.md` section 9. Status: **learning notebooks, not connected to the server yet.**

| Notebook | What it covers |
|---|---|
| `notebooks/01_posture_transformer.ipynb` | PmatData Exp. I → 10×10 windows, split by person, baseline, a Transformer built from scratch, leave-one-subject-out evaluation |

## Setup (Windows)

Needs [uv](https://docs.astral.sh/uv/) (or plain `python -m venv` with Python 3.12).

```bash
cd ai
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -r requirements.txt
```

In VS Code, open a notebook and pick the kernel `ai/.venv` (top right, "Select Kernel" → "Python Environments").

## Data

Datasets are **not** in git (size and licences). Unzip them next to the repo:

```
D:\Projects\Perfusense\
  repo\                      (this repository)
  datasets\
    pmd-1.0.0\a-pressure-map-dataset-for-in-bed-posture-classification-1.0.0\experiment-i\...
    PoPu-main\PoPu-main\PoPu_data\...   (unzip PoPu_data_no_segments.zip inside)
```

Elsewhere, set the environment variable `PERFUSENSE_DATA` to your `datasets` folder.

What the downloads contain (checked 2026-11-02):

| Download | Contents |
|---|---|
| PmatData `pmd-1.0.0.zip` | real data (PhysioNet, ODC-By 1.0: cite it) |
| `PoPu-main.zip` | real data (CC0); the pressure files are in the inner `PoPu_data_no_segments.zip` |
| `SLP-Dataset-and-Code-master.zip` | code only; data needs the ACLab request form |
| `bodies-at-rest-master.zip` | code + download scripts (PressurePose, ~10 GB synthetic, SMPL account) |
| `BodyPressure-master.zip` | code + download scripts (BodyPressureSD, 8.5 GB) |
