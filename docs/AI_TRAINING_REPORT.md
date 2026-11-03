# PerfuSense — AI Posture Model: Data, Training and Results (Lesson 1)

Nov 3, 2026 · Fares Hassan (with Claude Code) · Source: `ai/notebooks/01_posture_transformer.ipynb` in the PerfuSense repo

> PerfuSense is a research prototype, not a medical device. Nothing in this report is a clinical claim. Every number below was measured by running the notebook; nothing is estimated or invented.

---

## 1. Summary

- **Task:** read 30 seconds of pressure-mat frames (30 frames × 10×10 cells) and classify the lying position as **supine, left side or right side**.
- **Data used so far:** PmatData Experiment I (PhysioNet): **13 real people, 221 recordings, 19,563 clean frames, 1,409 training windows.**
- **Models:** a no-attention **baseline** (average over time + small neural network, 6,659 parameters) and a **Transformer** encoder built from scratch in TensorFlow/Keras (75,651 parameters).
- **Honest result (leave-one-person-out, 13 people):**
  - Baseline: **96.7 % ± 4.4** balanced accuracy
  - Transformer: **96.1 % ± 5.9** balanced accuracy
  - **They are tied.** The difference (0.6 points) is much smaller than the spread between people.
- **Why tied:** in this dataset people lie still, so the order of frames carries almost no information. Attention over time has nothing extra to use.
- **Important limit:** these scores use the **whole bed** shrunk to 10×10. Our real mat covers only 30×30 cm, so it sees much less of the body. The score on our own mat is **not measured yet.**

**Poster sentence:** *"96 % balanced accuracy on people the model never saw (public PmatData, full-bed view); not yet tested on our own mat."*

---

## 2. The data we have (checked file by file)

Five downloads were planned. When opened, only **two contain data**; the other three are code with download scripts.

| Download | What is really inside | Usable now? |
|---|---|---|
| **PmatData** (`pmd-1.0.0.zip`, 107 MB) | Real data. Exp. I: 13 people × 17 positions, 32×64 mat, 1 frame/s. Exp. II: 8 people, 29 states, one averaged frame each, air and sponge mattress | **Yes (used)** |
| **PoPu** (`PoPu-main.zip`, 162 MB) | Real data. 60 people × 28 positions (supine, prone, left, right × 7 variations) × 3 small shifts, plus empty bed. Top sheet 27×64 (Tactilus) and under-mattress sheet 12×6 (Sensomatt). 10 snapshots per recording | **Yes (Lesson 2)** |
| **SLP** (`SLP-Dataset-and-Code-master.zip`, 3.5 MB) | Code only. The data needs the ACLab request form with an institution email; non-commercial use only | No |
| **PressurePose** (`bodies-at-rest-master.zip`, 7 MB) | Code + download scripts. Synthetic set ≈ 10 GB, real set ≈ 10 GB (Harvard Dataverse). Needs a free SMPL account | No (download later) |
| **BodyPressureSD** (`BodyPressure-master.zip`, 8 MB) | Code + download scripts. Synthetic set 8.5 GB | No (download later) |

### 2.1 PmatData Experiment I in detail

| Property | Value |
|---|---|
| Host / licence | PhysioNet, Open Data Commons Attribution 1.0 (must be cited) |
| Sensor | Vista Medical FSA SoftFlex 2048, 32 × 64 = 2,048 sensors |
| Sampling rate | 1 frame per second |
| Participants | 13 healthy adults, age 19–34, height 169–186 cm, weight 63–100 kg |
| Positions | 17 per person → 221 recordings |
| File format | plain text, one row per frame, 2,048 numbers per row |
| Frames per recording | **62 to 211** (mean ≈ 91) — the documentation says "about 120" |
| Value range | documentation says 0–1000; **measured up to 4,095** (top of a 12-bit sensor) |
| Orientation | each row reshaped to 64 × 32 (head at the top) — **checked visually** |

### 2.2 From 17 positions to 3 classes

Taken from `experiment-info.docx` (the table is stored as an image in the file):

| Position numbers | Description | Our class |
|---|---|---|
| 1, 8, 9, 10, 11, 12 | supine, flat bed | supine |
| 15, 16, 17 | supine, head of bed raised 30°, 45°, 60° | supine |
| 2, 4, 5 | right side: flat, 30° wedge, 60° wedge | right |
| 13 | right foetal | right |
| 3, 6, 7 | left side: flat, 30° wedge, 60° wedge | left |
| 14 | left foetal | left |

Result per class (raw files):

| Class | Recordings | Frames |
|---|---|---|
| supine | 117 | 10,613 |
| left | 52 | 4,739 |
| right | 52 | 4,672 |
| **total** | **221** | **20,024** |

The classes are **unbalanced**: supine is about 53 %. A model that always says "supine" would already get 53 % plain accuracy. That is why we report **balanced accuracy** (each class counts equally; guessing = 33 %) and **macro F1**.

---

## 3. Data checks and cleaning (data wrangling)

We plotted the data **before** training. That found three things:

### 3.1 Broken startup frames (fixed)

- In **every** recording, the first frames are not a person: total pressure jumps to about **25 times** its normal value, then drops.
- Count across all 221 files: 2 bad frames in 215 files, 3 in 4 files, 4 in 1 file, 15 in 1 file.
- **Cleaning rule:** inside each recording, drop any frame whose total pressure is more than 3× or less than ⅓ of that recording's median.
- **Removed 461 frames** (2.3 %) → **19,563 clean frames.**
- Why it matters: per-window scaling (below) would otherwise squash the real body to almost zero in the first window of every recording.

### 3.2 People lie still

- After cleaning, frame-to-frame change is about **2 %** of the mean pressure, with small bumps (breathing, small shifts).
- So the timing inside a 30-second window carries almost no information. This predicted the tie between the Transformer and the baseline.

### 3.3 Sensor creep

- While a person lies still, total pressure **slowly rises by about 10–15 %** over 80 seconds (seen in the plotted S1 recordings).
- This is creep, which every soft pressure mat shows, including our Velostat mat. Per-window scaling removes most of it.

---

## 4. Preprocessing pipeline

| Step | What | Why |
|---|---|---|
| 1. Load | text file → array (frames, 64, 32) | |
| 2. Clean | drop startup / abnormal frames (section 3.1) | remove non-body frames |
| 3. Resize | **area-average** each frame from 64×32 to **10×10** | match our mat's grid; every sensor counts, no rows or columns dropped |
| 4. Window | slide a **30-frame** window with a **stride of 10** frames | 30 s at 1 Hz, the same input the server will send |
| 5. Normalise | divide each window by its own **99th percentile**, clip to 0–1 | removes unit differences between mats (raw counts, mmHg, our voltage bytes) and most creep; the 99th percentile ignores single noisy cells. **The same function must run on the server.** |

**Resize choice (decision):** for Lesson 1 we shrink the **whole mat** to 10×10. The alternative, cropping only the 30×30 cm area our mat would see, matches our hardware better but needs the exact sensor spacing from the mat's datasheet. That is Lesson 3.

**Result:** **1,409 windows**, shape (30, 10, 10):

| Class | Windows |
|---|---|
| supine | 746 |
| left | 336 |
| right | 327 |

---

## 5. How we split the data (and why)

### 5.1 Split by person, never randomly

Windows from the same recording overlap (two neighbouring windows share 20 of their 30 frames), and each person has a recognisable body shape. A random split puts almost-copies of test data into training. In the hospital the model always meets a **new person**, so the test set must contain only people the model never saw.

**Proof from our data** (logistic regression on the time-averaged 10×10 picture):

| Test | Random split (wrong) | Split by person (honest) |
|---|---|---|
| 3 classes (supine / left / right) | 100 % | 100 % |
| 17 exact positions (harder) | **96.5 %** | **77.7 %** |
| "Which of the 13 people is it?" (chance 7.7 %) | **81.8 %** | — |

- On the easy 3-class task there is nothing to inflate. On the harder task the random split looks **19 points better than reality.**
- The model can recognise **who** is lying on the mat 82 % of the time from one pressure picture. That is exactly the shortcut a random split rewards.

### 5.2 Splits used

| Set | People | Windows | Purpose |
|---|---|---|---|
| train | S1–S8 | 939 | learn weights |
| validation | S9–S10 | 165 | early stopping |
| test | S11–S13 | 305 | single honest check |
| **Final evaluation** | all 13, leave-one-person-out | — | each person is the test once, the next person is validation, the other 11 train |

---

## 6. The models

### 6.1 Baseline (no attention, no time)

Average the 30 frames into one 10×10 picture → Dense(64, ReLU) → Dropout 0.2 → Dense(3). **6,659 parameters.** If the Transformer cannot beat this, attention is not helping.

### 6.2 Transformer encoder (built from scratch)

Each **frame is one token** (like one word in a sentence).

| Step | Output shape | Detail | Parameters |
|---|---|---|---|
| Input | (30, 10, 10) | one 30-second window | 0 |
| Frames → tokens | (30, 100) | flatten each frame | 0 |
| Embedding | (30, 64) | Dense 100 → 64 | 6,464 |
| Learned positions | (30, 64) | adds a trainable vector per second (attention alone ignores order; we proved it with a shuffle test) | 1,920 |
| Encoder block 1 | (30, 64) | LayerNorm → **multi-head self-attention (4 heads × 16)** → residual; LayerNorm → feed-forward 64→128 (GELU)→64 → residual; dropout 0.1 | 33,472 |
| Encoder block 2 | (30, 64) | same | 33,472 |
| Final LayerNorm | (30, 64) | | 128 |
| Average over time | (64) | one summary of the window | 0 |
| Dropout + Dense | (3) | logits for supine / left / right | 195 |
| **Total** | | | **75,651** |

- **Attention formula:** Attention(Q, K, V) = softmax(Q·Kᵀ / √d_k) · V. Each second "looks at" every other second and takes a weighted mix.
- The multi-head attention layer is **our own code**. Check: it has exactly the same parameter count (16,640) as Keras' built-in `MultiHeadAttention`.
- **Encoder only** (like BERT, not GPT): we classify a whole window and generate nothing, so no causal mask is needed.
- **Pre-norm** (LayerNorm before attention) for more stable training.
- Too big for the ESP32, so it will run on the server (planned FastAPI service).

---

## 7. Training setup

| Setting | Value |
|---|---|
| Framework | TensorFlow 2.21.0, Keras 3.15.1, Python 3.12 |
| Hardware | laptop CPU only (Windows 11, no GPU) |
| Loss | sparse categorical cross-entropy on logits |
| Optimizer | Adam, learning rate 0.001 |
| Batch size | 32 |
| Max epochs | 60 |
| Early stopping | on validation loss, patience 8, keep best weights |
| Class weights | supine 0.63, left 1.42, right 1.42 (balance the classes) |
| Random seed | 42 (repeatable runs) |
| Augmentation | none yet |
| Training time | ≈ 20 s per Transformer; full leave-one-person-out (26 models) ≈ 9 minutes |

**Behaviour:** training accuracy reaches 100 % by epoch 3. Validation accuracy (new people) stays between 91 and 93 %, and the best epoch was 8. The gap shows some overfitting to the training people, which early stopping limits.

---

## 8. Results

### 8.1 Single split (test people S11–S13, 305 windows)

| Model | Balanced accuracy | Macro F1 |
|---|---|---|
| Baseline | 100 % | 1.000 |
| Transformer | 95.6 % | 0.953 |

Transformer confusion matrix (rows = truth, columns = prediction):

| | supine | left | right |
|---|---|---|---|
| **supine** | 157 | 0 | 4 |
| **left** | 0 | 78 | 0 |
| **right** | 0 | **7** | 59 |

The Transformer's main mistake was **right → left**, the worst mistake for PerfuSense (it would show the wrong side as unloaded). Three people is a small test, so the fair comparison is the next table.

### 8.2 Leave-one-person-out (final, 13 people)

Balanced accuracy when each person is the test person:

| Test person | Baseline | Transformer |
|---|---|---|
| S1 | 1.000 | 0.965 |
| S2 | 0.930 | 1.000 |
| S3 | 1.000 | 1.000 |
| S4 | 0.895 | 1.000 |
| S5 | 1.000 | 1.000 |
| S6 | 1.000 | 1.000 |
| S7 | 0.962 | 1.000 |
| S8 | 1.000 | 0.915 |
| S9 | 0.983 | 0.957 |
| S10 | 0.887 | 0.850 |
| S11 | 1.000 | 1.000 |
| S12 | 1.000 | 0.979 |
| S13 | 0.917 | 0.833 |
| **Mean ± std** | **0.967 ± 0.044** | **0.961 ± 0.059** |
| Macro F1 mean ± std | 0.968 ± 0.042 | 0.965 ± 0.054 |

### 8.3 What the results mean

1. **Tie.** The Transformer is 11× bigger and not better on this data. That is a valid scientific finding: on still postures, attention over time does not help.
2. **People differ.** S10 and S13 are the hardest for both models. With only 13 people, always report the spread, not just the mean.
3. **The full-bed task is too easy.** Even a linear model gets ~100 % on the 3 classes. The real test is the small 30×30 cm patch our mat sees.
4. **Where the Transformer should matter:** recordings with real movement and turns (our own mat), and turn **events** detected over time.

---

## 9. Key definitions (for slides)

| Term | Meaning in this project |
|---|---|
| frame | one reading of the whole mat at one moment (10×10, once per second) |
| recording | one file: one person in one position for 1–3 minutes |
| window / sample | 30 consecutive frames + label = one training example |
| token | one element the Transformer reads; here one frame |
| batch / step / epoch | 32 samples / one weight update / one pass over all training data |
| state vs event | the model classifies **states** ("lying left"); **events** ("turned at 14:02") are found later by comparing predictions over time |
| balanced accuracy | average of the per-class accuracies; guessing = 33 % |
| leave-one-person-out | train 13 times, each time testing on one person never seen in training |

---

## 10. Honest limits

- **Public accuracy is not our accuracy.** Nothing here has been tested on the Velostat mat.
- **Full-bed view.** Our mat sees only 30×30 cm; expect lower scores there.
- **Healthy volunteers lying still** for 1–3 minutes. No patients, no long recordings, no real turns.
- **Only 13 people** in this dataset. Results move several points from person to person.
- **3 classes only.** Wedge and foetal positions are grouped into left / right; prone and empty bed are not included yet.
- **Different sensors.** The hospital mat reports raw counts; ours reports voltage bytes. Per-window scaling reduces the gap but does not remove it.
- **Licence:** PmatData (ODC-By 1.0) must be cited wherever it is used, including the poster.

---

## 11. Next steps

| Lesson | Plan |
|---|---|
| 2 | Add PoPu-Data (60 people): a second real dataset and the **empty bed** class; combine two different mats |
| 3 | Crop the **30×30 cm patch** our mat would see instead of the whole bed (needs sensor spacing from the datasheets) |
| 4 | Download synthetic data (PressurePose / BodyPressureSD), pre-train on it, fine-tune on real data |
| 5 | Record our own mat, adapt the model, report **our-mat accuracy separately** |
| 6 | Serve the model with FastAPI; the server sends the last 30 frames at 1 Hz |

---

## 12. Suggested slides

1. **The question:** can 30 seconds of a 10×10 mat tell supine / left / right?
2. **Data reality check:** 5 datasets planned, 2 usable today (table in section 2).
3. **Look before you train:** broken startup frames, creep, people lying still (section 3).
4. **Pipeline:** clean → 10×10 → 30-s windows → per-window scaling (section 4).
5. **Split by person:** 96.5 % (random) vs 77.7 % (honest) on 17 positions (section 5).
6. **The Transformer:** frames as tokens, attention, 75,651 parameters (section 6).
7. **Results:** baseline 96.7 % vs Transformer 96.1 %, tied (section 8).
8. **What it means and next steps:** our own mat, real turns, 30×30 cm patch (sections 10–11).

---

## 13. References

1. M. B. Pouyan, J. Birjandtalab, M. Heydarzadeh, M. Nourani, S. Ostadabbas, "A pressure map dataset for posture and subject analytics," *IEEE EMBS Int. Conf. Biomedical & Health Informatics (BHI)*, 2017. doi:10.1109/BHI.2017.7897206. Data: PhysioNet, PmatData v1.0.0, https://physionet.org/content/pmd/1.0.0/
2. A. L. Goldberger et al., "PhysioBank, PhysioToolkit, and PhysioNet," *Circulation*, vol. 101, no. 23, 2000.
3. L. Fonseca et al., "PoPu-Data: A multilayered, simultaneously collected lying position dataset," *Data*, vol. 8, no. 7, p. 120, 2023. doi:10.3390/data8070120
4. A. Vaswani et al., "Attention is all you need," *NeurIPS*, 2017 (the original Transformer).
