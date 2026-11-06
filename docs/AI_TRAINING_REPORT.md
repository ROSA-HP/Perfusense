# PerfuSense — AI Posture Model: Full Training Report

Nov 6, 2026 · Fares Hassan (with Claude Code) · Source: `ai/` in the PerfuSense repo, notebooks 01–06

> PerfuSense is a research prototype, not a medical device. Nothing in this report is a clinical claim. Every result below was measured by running the notebooks. All code shown is copied automatically from the real files, so it is the code that ran.

This report replaces the Lesson 1 version from Nov 3. Three things in that version changed: the data now covers two real datasets and one synthetic set; PoPu *can* give 30-frame windows; and BodyPressureSD is not freely open (see section 2).

---

## 1. Summary

**Task:** read 30 seconds of a 10×10 pressure mat and say whether a person is lying **supine, on the left or on the right**. An empty bed is found by a rule before the model runs.

**Data:** 73 real people on two hospital mats (PmatData, PoPu) plus 12,381 synthetic maps (BodyPressureSD).

**Models built:** a Transformer encoder written from scratch in TensorFlow/Keras (75,651 parameters) and two simple models (6,659 parameters each).

**Final model:** the simple **last-frames** model with synthetic pre-training, because it beat the Transformer in the fair final test. It is saved as a file and served by a FastAPI service. Switching to the Transformer is a one-line change.

**Final honest result** (73 people, each tested unseen, 5-fold, only the 30×30 cm our mat would see, hospital mats):

| | Final model (last-frames, pre-trained) | Transformer (pre-trained) |
|---|---|---|
| **Balanced accuracy** | **84.7 %** | 80.8 % |
| Macro F1 | 0.847 | 0.807 |
| Still windows | 81.7 % | 80.1 % |
| Windows with a real turn | 94.2 % | 84.0 % |
| PmatData people | 61.9 % | 60.5 % |
| PoPu people | 90.1 % | 86.0 % |
| Left and right swapped | 9.4 % of side windows | 12.1 % |
| Parameters | 6,659 | 75,651 |

**Neither has been tested on our Velostat mat.** Guessing would score 33 %.

**How the score changed as the test became more honest:**

| Step | What changed | Balanced accuracy on unseen people |
|---|---|---|
| Lesson 1 | one mat, whole bed, still people | 96.1 % |
| Lesson 2 | two mats, whole bed | 96.5 % |
| Lesson 2 | trained on one mat, tested on the other | 55–72 % |
| Lesson 3 | **only the 30×30 cm our mat sees** | 75.1 %, then 78.0 % with placement training |
| Lesson 4 | real movement, 4 postures, patch | 86.4 % (averaging baseline 78.4 %) |
| Lesson 5 | synthetic pre-training, 19 test people | 81.1 % (72.4 % without) |
| Lesson 6 | final recipe, all together | **84.7 %** final model, 80.8 % Transformer |

**The five findings for the presentation:**

1. **Seeing less costs a lot.** Going from the whole bed to our small mat costs about 20 points.
2. **Datasets disagree on left and right.** Two of three had to be flipped; without that the score is pure guessing.
3. **A new mat is a new problem.** A model trained on one mat falls to 53–76 % on another, even on the whole bed.
4. **The Transformer lost a fair test.** Time matters when people move (the averaging baseline falls to 60.9 %), but a model 11 times smaller that reads only the newest 5 frames scored 84.7 % against the Transformer's 80.8 %.
5. **Pre-training helps most when real data is scarce.** With 5 real people it scored 65 % against 48 % on still windows. That is what a small team with a small mat needs. Its limit: repeated-frame synthetic data lowered the Transformer on real turns (90.7 → 84.0 %).

**Poster sentence:** *"84.7 % balanced accuracy on 73 people the model never saw, using only the 30×30 cm our mat would cover (public hospital-mat data). Not yet tested on our own mat."*

---

## 2. The data (checked file by file)

| Dataset | Type | People | Mat | What we used | Licence |
|---|---|---|---|---|---|
| **PmatData Exp. I** | real | 13 | Vista FSA, 32×64, 1 Hz | 221 recordings, 19,563 clean frames | ODC-By 1.0, must be cited |
| **PoPu-Data** | real | 60 | Tactilus, 27×64, about 2 Hz | 1,680 recordings + full sessions | README: CC0. One catalogue lists CC BY 4.0, so cite it |
| **BodyPressureSD** | synthetic | none | simulated, 27×64 | 12,381 of 97,495 maps | CC BY-SA 4.0 + **non-commercial academic or non-profit research only** |
| PressurePose | synthetic | — | simulated | not downloaded | **non-commercial research only** |
| SLP | real | 109 | Tekscan | not available: needs request form | non-commercial |
| PmatData Exp. II | real | 9 listed | BodiTrak | **left out**, see below | ODC-By 1.0 |

**Correction to the dataset notes:** the Nov 2 dataset file calls PressurePose and BodyPressureSD "open". They are free to download, but their licences allow non-commercial research only, and downloading means accepting that. The team accepted this for the 6 BodyPressureSD files we use. The poster must cite them.

**Why PmatData Exp. II was left out:** it is stored upside down, has stuck sensors at 4,095 and a background of about 38, each file is a single averaged frame, 3 files are undocumented, and its 9 listed people have the same age, height and weight as people in Exp. I, so it is not a test on new people.

---

## 3. The whole pipeline

```
PmatData text files ─┐
PoPu JSON files ─────┼─ load → clean → one view (flip) → crop 10×10 patch → 30-frame windows → scale
BodyPressureSD .p ───┘
        │
        ├─ synthetic windows ──> PRE-TRAIN each model ───> saved weights
        │                                                     │
        └─ real windows (split by person) ──> FINE-TUNE <─────┘
                                                  │
                  5-fold by person ──> honest accuracy
                                                  │
                  train on everyone ──> posture.keras + posture.json ──> FastAPI service
```

---

## 4. Collecting and preparing the data, step by step

All of this is in `ai/perfusense_ai/data.py`. Training and the service share the same file, so they cannot drift apart.

### Step 1 · Load PmatData

Each file is text: one row per second, 2,048 numbers. We reshape to 64×32 and plot it to confirm a body appears with the head at the top. The documentation says values are 0–1000 and files hold about 120 frames. We measured up to 4,095 and 62–211 frames.

```python
def load_pmd_file(path):
    """One PmatData Exp. I file -> (frames, 64, 32)."""
    table = pd.read_csv(path, sep=r"\s+", header=None).to_numpy(dtype="float32")
    return table.reshape(-1, 64, 32)
```

### Step 2 · Turn 17 positions into 3 classes

From `experiment-info.docx`. Supine has 9 positions, left and right 4 each, so classes are unbalanced. That is why we report balanced accuracy and use class weights.

```python
PMD_POSITION_TO_CLASS = {
    1: "supine", 8: "supine", 9: "supine", 10: "supine", 11: "supine", 12: "supine",
    15: "supine", 16: "supine", 17: "supine",
    2: "right", 4: "right", 5: "right", 13: "right",
    3: "left", 6: "left", 7: "left", 14: "left",
}
```

### Step 3 · Clean bad frames

Plots showed that the first frames of every file are a startup spike, about 25× the normal pressure. The rule below removed 461 of 20,024 frames (2 in 215 files, 3 in 4 files, 4 in 1 file, 15 in 1 file).

```python
def drop_bad_frames(frames, factor=3.0):
    """Remove frames whose total pressure is far from the recording's median."""
    total = frames.sum(axis=(1, 2))
    med = np.median(total)
    keep = (total < factor * med) & (total > med / factor)
    return frames[keep]


def load_pmd():
    """All 221 recordings, cleaned. One dict per recording."""
    root = pmd_exp1_dir()
    recordings = []
    for subject in range(1, 14):
        for position, label in PMD_POSITION_TO_CLASS.items():
            frames = drop_bad_frames(load_pmd_file(root / f"S{subject}" / f"{position}.txt"))
            recordings.append({"dataset": "pmd", "person": f"pmd-{subject}", "position": str(position),
                               "label": label, "frames": frames})
    return recordings
```

### Step 4 · Load PoPu and join its files

PoPu stores 10 snapshots per JSON file. Each pose has 3 files (`_0`, `_1`, `_2`: the person shifts slightly between them), so joining them gives exactly 30 snapshots, one window. The snapshot `id` turned out to be a clock (day, month, hour, minute, second, hundredth). From it we measured about 0.5 s between snapshots, and about 33 s for all 30: very close to our 30-second window. This timing is our own reading of the ids; the paper could not be accessed to confirm it.

```python
def popu_time(snapshot_id):
    """A PoPu snapshot id is a clock reading DDMMHHMMSScc. Returns seconds."""
    s = str(snapshot_id).zfill(12)
    day, _, hour, minute, sec, centi = (int(s[i:i + 2]) for i in range(0, 12, 2))
    return ((day * 24 + hour) * 60 + minute) * 60 + sec + centi / 100


def load_popu_file(path, mirror=True):
    """One PoPu JSON file -> frames (n, 64, 27), times (n,) in seconds.

    mirror=True flips the columns into the training view: Lesson 2 shows PoPu needs this.
    """
    with open(path) as f:
        snapshots = json.load(f)["snapshots"].values()
    frames = np.array([s["tactilus_readings"] for s in snapshots], dtype="float32").reshape(-1, 64, 27)
    times = np.array([popu_time(s["id"]) for s in snapshots])
    return (frames[:, :, ::-1] if mirror else frames), times


def load_popu(mirror=True):
    """Each position's three 10-snapshot files joined into one 30-snapshot recording. Prone is kept."""
    root = popu_dir()
    recordings = []
    for person in range(1, 61):
        for label in ("supine", "prone", "left", "right"):
            for variation in range(1, 8):
                parts = [load_popu_file(root / str(person) / f"{label}{variation}_{k}.json", mirror)[0]
                         for k in range(3)]
                recordings.append({"dataset": "popu", "person": f"popu-{person}",
                                   "position": f"{label}{variation}", "label": label,
                                   "frames": np.concatenate(parts)})
    return recordings
```

### Step 5 · Put every dataset in one view

Both datasets say "left", but their pictures are mirror images. We proved it: train on one, test on the other, with and without flipping.

| Test (whole bed, simple model) | As stored | Flipped |
|---|---|---|
| Train PmatData → test PoPu | 35.1 % | 58.6 % |
| Train PoPu → test PmatData | 35.0 % | 73.5 % |
| Train synthetic → test real people | 34.4 % | 55.7 % |

35 % is guessing. So PoPu and the synthetic data are flipped into PmatData's direction, called the **training view**.

Physically, weight moves to the side you lie on. PoPu, the synthetic data and our server's zones (`col < mid` = LEFT) agree with each other, so PmatData looks like the odd one out. Training only needs the datasets to agree. Frames from our mat are flipped once on the way into the model:

```python
def mat_to_model(frames):
    """Frames from our mat (column 0 = patient's left) -> training view. Flips the columns."""
    return frames[..., ::-1]
```

**This must be confirmed on our own mat:** lie on your left and check the answer.

### Step 6 · The empty bed

On PoPu, total pressure separates empty from occupied cleanly (largest empty 1,965, smallest occupied 3,416, typical occupied about 300× a typical empty). The hottest cell does **not**: one empty frame has a cell at 104 (full scale), while some occupied frames peak at 29. So the empty rule uses average pressure, not the hottest cell, and it runs **before** scaling, because scaling turns noise into a fake picture. This differs from the old plan ("no cell above a threshold"). The threshold is a placeholder until measured on our mat.

### Step 7 · Measure the sensor spacing

No datasheet or paper with the spacing could be found, so we measured it: height ÷ rows covered by the body on a flat supine map.

```python
def body_rows(mean_map):
    """How many rows have pressure, from the head to the heels."""
    rows = np.flatnonzero(mean_map.max(axis=1) > 0.05 * mean_map.max())
    return rows.max() - rows.min() + 1
```

Result: **2.85 cm per sensor on both mats** (spread about 0.12), against 3.0 cm on our mat. So a 10×10 block of sensors is almost exactly our mat: no resizing needed. It is an estimate: lying length is not exactly height, and spacing across the mat is assumed equal.

### Step 8 · Cut the 30×30 cm patch

The mat goes under the lower back. We find that place on each person's flat supine map, then keep it **fixed** for all of their postures, because a real mat does not move when the patient turns. A first rule (the hottest box anywhere) put the mat on the shoulders for 13 of 73 people. A second rule (middle third of the body) still caught some chests. The final rule keeps the box centre 42–62 % of the way from head to heel. `jitter` moves the mat up to 2 sensors (about 6 cm) to imitate a careless placement.

```python
def pad_to_width(frames, width=32):
    """Add empty columns on both sides, so a narrower mat keeps its real scale."""
    missing = width - frames.shape[2]
    left = missing // 2
    return np.pad(frames, ((0, 0), (0, 0), (left, missing - left)))


def sacrum_point(mean_map):
    """Top-left corner of the mat on a flat supine map: the 10 x 10 box with the most pressure, with
    its centre 42-62 % of the way from head to heel. Searching more widely can pick the shoulders."""
    rows = np.flatnonzero(mean_map.max(axis=1) > 0.05 * mean_map.max())
    head, feet = rows.min(), rows.max()
    c = np.pad(np.cumsum(np.cumsum(mean_map, axis=0), axis=1), ((1, 0), (1, 0)))
    box = c[GRID:, GRID:] - c[:-GRID, GRID:] - c[GRID:, :-GRID] + c[:-GRID, :-GRID]
    centre = np.arange(box.shape[0]) + GRID / 2
    box[(centre < head + 0.42 * (feet - head)) | (centre > head + 0.62 * (feet - head))] = -1
    r0, c0 = np.unravel_index(np.argmax(box), box.shape)
    return int(r0), int(c0)


def crop_patch(frames, top, left, size=GRID):
    """Cut a size x size sensor patch. Sensors are about 2.9 cm apart, so 10 sensors is about 29 cm."""
    h, w = frames.shape[1:]
    top = int(np.clip(top, 0, h - size))
    left = int(np.clip(left, 0, w - size))
    return frames[:, top:top + size, left:left + size]


def mat_positions(recordings):
    """Where the mat would lie under each person: one fixed box per person, set from flat supine."""
    maps = {}
    for r in recordings:
        flat = r["dataset"] == "popu" and r["label"] == "supine" or \
               r["dataset"] == "pmd" and int(r["position"]) in PMD_FLAT_SUPINE
        if flat:
            maps.setdefault(r["person"], []).append(pad_to_width(r["frames"]).mean(axis=0))
    return {person: sacrum_point(np.mean(m, axis=0)) for person, m in maps.items()}


def patch_view(positions, jitter=0, rng=None):
    """Build a `view` for windows_from_recordings. `jitter` moves the mat by up to that many sensors."""
    def view(recording):
        top, left = positions[recording["person"]]
        if jitter:
            top += int(rng.integers(-jitter, jitter + 1))
            left += int(rng.integers(-jitter, jitter + 1))
        return crop_patch(pad_to_width(recording["frames"]), top, left)
    return view
```

The mat sees only 16–30 % of the body's pressure.

### Step 9 · Whole-bed view (Lessons 1–2 only)

Used for comparison. Area averaging keeps every sensor.

```python
def area_resize(frames, h=GRID, w=GRID):
    """(T, H, W) -> (T, h, w) by averaging areas. Every sensor counts, even when sizes do not divide."""
    frames = np.asarray(frames, dtype="float32")
    _, H, W = frames.shape

    def weights(n_in, n_out):
        m = np.zeros((n_out, n_in), dtype="float32")
        edges = np.linspace(0, n_in, n_out + 1)
        for i in range(n_out):
            for j in range(n_in):
                m[i, j] = max(0.0, min(edges[i + 1], j + 1) - max(edges[i], j))
        return m / m.sum(axis=1, keepdims=True)

    return np.einsum("ih,thw,jw->tij", weights(H, h), frames, weights(W, w))


def whole_bed_view(recording):
    """The whole mat on a common 32-sensor width, averaged to 10 x 10."""
    return area_resize(pad_to_width(recording["frames"]))
```

### Step 10 · Windows and scaling

Slide a 30-frame window along each recording, stride 10. Each window is scaled by its own 99th percentile, which removes unit differences between mats and most sensor creep (total pressure rises 10–15 % over 80 s while a person lies still). The same function runs in the service.

```python
def normalise_window(x, eps=1e-6):
    """Scale a window to 0..1 by its own 99th percentile. Used in training AND serving."""
    top = float(np.percentile(x, 99))
    return np.clip(x / max(top, eps), 0.0, 1.0).astype("float32")


def windows_from_recordings(recordings, view, stride=10, classes=CLASSES):
    """Cut recordings into normalised windows. `view` turns (n, 64, W) frames into (n, 10, 10).

    Returns X (windows, 30, 10, 10), y (class index), people (person of each window).
    """
    X, y, people = [], [], []
    for r in recordings:
        if r["label"] not in classes:
            continue
        small = view(r)
        for start in range(0, len(small) - T + 1, stride):
            X.append(normalise_window(small[start:start + T]))
            y.append(classes.index(r["label"]))
            people.append(r["person"])
    return np.stack(X), np.array(y), np.array(people)
```

### Step 11 · Rebuild real sessions (Lesson 4)

PoPu's `others.json` holds every frame **between** labelled positions, so we can sort all frames by clock and rebuild each person's session of about 17 minutes, then keep the newest frame at each second, as a server would. Windows end on a labelled second. "Moving" windows still contain the previous posture.

```python
def load_popu_session(person):
    """One person's whole session in time order: frames (n, 64, 27), times (n,), names (n,).

    Names are like 'left3' for labelled snapshots and 'others' for frames between them.
    """
    root = popu_dir() / str(person)
    frames, times, names = [], [], []
    for path in sorted(root.glob("*.json")):
        f, t = load_popu_file(path)
        frames.append(f)
        times.append(t)
        names += [re.sub(r"_\d$", "", path.stem)] * len(f)
    frames, times, names = np.concatenate(frames), np.concatenate(times), np.array(names)
    order = np.argsort(times, kind="stable")
    return frames[order], times[order], names[order]


def resample_1hz(frames, times, names):
    """Keep the latest frame at each whole second, like a server that samples once per second."""
    seconds = np.arange(np.ceil(times[0]), times[-1])
    index = np.searchsorted(times, seconds, side="right") - 1
    return frames[index], seconds - seconds[0], names[index]


def session_seconds(person, view):
    """One PoPu person at 1 Hz: small frames (n, 10, 10) and the class of each second.

    `view` works like in windows_from_recordings. Seconds between labelled positions get the class "".
    """
    frames, times, names = load_popu_session(person)
    frames, _, names = resample_1hz(frames, times, names)
    small = view({"person": f"popu-{person}", "frames": frames})
    classes = np.array([re.match(r"[a-z]*", n).group() if n != "others" else "" for n in names])
    return small, classes


def session_windows(person, view, classes=CLASSES_WITH_PRONE, still_stride=10):
    """Windows that END on a labelled second. The label is the posture at that last second.

    Windows that still hold a different posture in their first seconds ("moving" windows) are all
    kept. Windows with one posture only are thinned out to one every `still_stride` seconds.
    """
    small, labels = session_seconds(person, view)
    X, y, moving = [], [], []
    for end in range(T - 1, len(small)):
        if labels[end] not in classes:
            continue
        seen = {c for c in labels[end - T + 1:end + 1] if c}
        is_moving = len(seen) > 1
        if is_moving or end % still_stride == 0:
            X.append(normalise_window(small[end - T + 1:end + 1]))
            y.append(classes.index(labels[end]))
            moving.append(is_moving)
    return np.stack(X), np.array(y), np.array(moving)
```

### Step 12 · Synthetic data, safely (Lesson 5)

The files are Python pickles, and a pickle can run code when opened. Our loader refuses everything except NumPy arrays. Each file name gives the posture. Each single map is repeated 30 times with 2 % noise to fill a window, so synthetic data teaches what a posture looks like, not how people move.

```python
class NumpyOnlyUnpickler(pickle.Unpickler):
    """Pickle files can run code when opened. This loader refuses everything except NumPy arrays."""
    ALLOWED = {("numpy.core.multiarray", "_reconstruct"), ("numpy._core.multiarray", "_reconstruct"),
               ("numpy.core.multiarray", "scalar"), ("numpy._core.multiarray", "scalar"),
               ("numpy", "ndarray"), ("numpy", "dtype")}

    def find_class(self, module, name):
        if (module, name) not in self.ALLOWED:
            raise pickle.UnpicklingError(f"blocked {module}.{name}")
        return super().find_class(module.replace("numpy.core", "numpy._core"), name)


def load_bodypressure(mirror=False):
    """Synthetic maps -> frames (n, 64, 27) and class index (n,). The file name gives the posture."""
    names = {"lay": "supine", "lside": "left", "rside": "right"}
    frames, labels = [], []
    for path in sorted((data_root() / "BodyPressureSD" / "synth").glob("train_slp_*.p")):
        with open(path, "rb") as f:
            images = NumpyOnlyUnpickler(f, encoding="latin1").load()["images"]
        maps = np.array(images, dtype="float32").reshape(-1, 64, 27)
        frames.append(maps[:, :, ::-1] if mirror else maps)
        labels += [CLASSES.index(names[path.name.split("_")[2]])] * len(maps)
    return np.concatenate(frames), np.array(labels)


def still_windows(frames, rng, noise=0.02):
    """Turn single frames (n, 10, 10) into 30-frame windows: repeat each one with small sensor noise."""
    return np.stack([normalise_window(np.repeat(f[None], T, axis=0)
                                      * (1 + noise * rng.standard_normal((T,) + f.shape))) for f in frames])


def synthetic_patch_windows(rng, jitter=2):
    """All steps of Lesson 5 in one call: X (n, 30, 10, 10) and class index (n,)."""
    frames, labels = load_bodypressure(mirror=True)
    padded = pad_to_width(frames)
    top, left = sacrum_point(padded[labels == 0].mean(axis=0))
    patches = np.stack([crop_patch(f[None], top + rng.integers(-jitter, jitter + 1),
                                   left + rng.integers(-jitter, jitter + 1))[0] for f in padded])
    return still_windows(patches, rng), labels
```

---

## 5. Splitting the data

### Split by person, always

Neighbouring windows share 20 of 30 frames, and bodies are recognisable. A random split would put near-copies of test data into training.

| Task (Lesson 1, simple model) | Random split (wrong) | Split by person (honest) |
|---|---|---|
| 3 classes, whole bed | 100 % | 100 % |
| 17 exact positions | 96.5 % | 77.7 % |
| "Which of 13 people is it?" (chance 7.7 %) | 81.8 % | — |

### Cross-validation

With 73 people we use 5-fold by person: every person is tested once, by a model that never saw them. Person names carry the dataset (`pmd-3`, `popu-17`), so two "person 3"s never mix.

```python
def cross_validate(builder, X, y, people, folds=5, batch_size=64, **train_args):
    """Train `folds` models. Every person is predicted once, by a model that never saw them."""
    pred = np.zeros_like(y)
    for k, (tr, te) in enumerate(GroupKFold(folds).split(X, y, people)):
        train_people = np.unique(people[tr])
        val_people = np.random.default_rng(k).choice(train_people, max(2, len(train_people) // 8), replace=False)
        va = np.isin(people[tr], val_people)
        keras.backend.clear_session()       # forget old models: keeps memory and speed steady
        keras.utils.set_random_seed(42)
        m = builder()
        train(m, X[tr][~va], y[tr][~va], X[tr][va], y[tr][va], batch_size=batch_size, **train_args)
        pred[te] = predict(m, X[te])
    return pred
```

---

## 6. The models

All in `ai/perfusense_ai/model.py`. Each **frame is one token**, like a word in a sentence.

### Attention, from scratch

**Attention(Q, K, V) = softmax(Q·Kᵀ / √d_k) · V.** Each second asks a question (query), compares it with every second's label (key), and takes a weighted mix of their content (value). Four heads of 16 numbers look for different things. Our layer has exactly the same 16,640 parameters as Keras' built-in one.

```python
@keras.saving.register_keras_serializable(package="perfusense")
class MultiHeadSelfAttention(layers.Layer):
    """Multi-head self-attention written from scratch."""

    def __init__(self, d_model, num_heads, dropout=0.0, **kwargs):
        super().__init__(**kwargs)
        assert d_model % num_heads == 0, "d_model must split evenly into heads"
        self.d_model, self.num_heads, self.dropout_rate = d_model, num_heads, dropout
        self.d_head = d_model // num_heads
        self.wq = layers.Dense(d_model, name="query")
        self.wk = layers.Dense(d_model, name="key")
        self.wv = layers.Dense(d_model, name="value")
        self.wo = layers.Dense(d_model, name="output")
        self.drop = layers.Dropout(dropout)

    def split_heads(self, x):
        # (B, T, d_model) -> (B, heads, T, d_head)
        b, t = tf.shape(x)[0], tf.shape(x)[1]
        x = tf.reshape(x, (b, t, self.num_heads, self.d_head))
        return tf.transpose(x, (0, 2, 1, 3))

    def call(self, x, training=False, return_attention=False):
        q = self.split_heads(self.wq(x))
        k = self.split_heads(self.wk(x))
        v = self.split_heads(self.wv(x))

        scores = tf.matmul(q, k, transpose_b=True) / tf.sqrt(float(self.d_head))  # (B, heads, T, T)
        weights = tf.nn.softmax(scores, axis=-1)
        out = tf.matmul(self.drop(weights, training=training), v)                 # (B, heads, T, d_head)

        b, t = tf.shape(x)[0], tf.shape(x)[1]
        out = tf.reshape(tf.transpose(out, (0, 2, 1, 3)), (b, t, self.d_model))   # merge heads
        out = self.wo(out)
        return (out, weights) if return_attention else out

    def get_config(self):
        return super().get_config() | {"d_model": self.d_model, "num_heads": self.num_heads,
                                       "dropout": self.dropout_rate}
```

### Positions

Attention alone ignores order: we proved that shuffled frames give identical averaged output. So each second gets a learned vector added.

```python
@keras.saving.register_keras_serializable(package="perfusense")
class PositionEmbedding(layers.Layer):
    """Adds a learned vector to each time step: token t gets x_t + p_t."""

    def __init__(self, length, dim, **kwargs):
        super().__init__(**kwargs)
        self.length, self.dim = length, dim

    def build(self, input_shape):
        self.pos = self.add_weight(name="pos", shape=(self.length, self.dim),
                                   initializer="random_normal", trainable=True)

    def call(self, x):
        return x + self.pos   # (B, T, dim) + (T, dim): broadcast over the batch

    def get_config(self):
        return super().get_config() | {"length": self.length, "dim": self.dim}
```

### Encoder block

LayerNorm → attention → residual, then LayerNorm → feed-forward (GELU) → residual.

```python
@keras.saving.register_keras_serializable(package="perfusense")
class EncoderBlock(layers.Layer):
    """Pre-norm Transformer encoder block: attention + feed-forward, each with a residual."""

    def __init__(self, d_model=64, num_heads=4, ff_dim=128, dropout=0.1, **kwargs):
        super().__init__(**kwargs)
        self.d_model, self.num_heads, self.ff_dim, self.dropout_rate = d_model, num_heads, ff_dim, dropout
        self.norm1 = layers.LayerNormalization(epsilon=1e-6)
        self.attn = MultiHeadSelfAttention(d_model, num_heads, dropout)
        self.drop1 = layers.Dropout(dropout)
        self.norm2 = layers.LayerNormalization(epsilon=1e-6)
        self.ff1 = layers.Dense(ff_dim, activation="gelu")
        self.drop2 = layers.Dropout(dropout)
        self.ff2 = layers.Dense(d_model)

    def call(self, x, training=False, return_attention=False):
        a, weights = self.attn(self.norm1(x), training=training, return_attention=True)
        x = x + self.drop1(a, training=training)                          # residual 1
        f = self.ff2(self.drop2(self.ff1(self.norm2(x)), training=training))
        x = x + f                                                          # residual 2
        return (x, weights) if return_attention else x

    def get_config(self):
        return super().get_config() | {"d_model": self.d_model, "num_heads": self.num_heads,
                                       "ff_dim": self.ff_dim, "dropout": self.dropout_rate}
```

### The full model and its simple competitors

```python
def build_transformer(t=30, h=10, w=10, num_classes=3, d_model=64, heads=4, ff=128, blocks=2, dropout=0.1):
    inp = keras.Input(shape=(t, h, w), name="window")
    x = layers.Reshape((t, h * w), name="frames_to_tokens")(inp)
    x = layers.Dense(d_model, name="embedding")(x)
    x = PositionEmbedding(t, d_model, name="positions")(x)
    for i in range(blocks):
        x = EncoderBlock(d_model, heads, ff, dropout, name=f"encoder_{i}")(x)
    x = layers.LayerNormalization(epsilon=1e-6, name="final_norm")(x)
    x = layers.GlobalAveragePooling1D(name="average_over_time")(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(num_classes, name="logits")(x)   # no softmax: the loss does it
    return keras.Model(inp, out, name="posture_transformer")


def build_baseline(t=30, h=10, w=10, num_classes=3):
    """No attention, no time: average the frames, then a small MLP."""
    inp = keras.Input(shape=(t, h, w), name="window")
    x = layers.GlobalAveragePooling1D(name="average_over_time")(layers.Reshape((t, h * w))(inp))
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(num_classes, name="logits")(x)
    return keras.Model(inp, out, name="baseline_mlp")


def build_last_frames(t=30, h=10, w=10, num_classes=3, n=5):
    """No attention: average only the newest n frames, then the same small MLP (Lesson 4)."""
    inp = keras.Input(shape=(t, h, w), name="window")
    x = layers.Reshape((t, h * w))(inp)
    x = layers.Cropping1D((t - n, 0), name="newest_frames")(x)
    x = layers.GlobalAveragePooling1D(name="average_over_time")(x)
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(num_classes, name="logits")(x)
    return keras.Model(inp, out, name="last_frames_mlp")
```

| Part | Shape | Parameters |
|---|---|---|
| Input | (30, 10, 10) | 0 |
| Frames → tokens | (30, 100) | 0 |
| Embedding, Dense 100→64 | (30, 64) | 6,464 |
| Learned positions | (30, 64) | 1,920 |
| Encoder block × 2 | (30, 64) | 2 × 33,472 |
| Final LayerNorm | (30, 64) | 128 |
| Average over time | (64) | 0 |
| Dropout + Dense | (3) | 195 |
| **Total** | | **75,651** |

The simple models have about 6,700 parameters. Encoder only, like BERT, because we classify and do not generate, so no causal mask is needed.

---

## 7. Training

```python
def train(model, X_tr, y_tr, X_va, y_va, epochs=60, batch_size=32, lr=1e-3, patience=8, verbose=0):
    """Same recipe as Lesson 1: Adam, class weights, early stopping on validation loss."""
    model.compile(
        optimizer=keras.optimizers.Adam(lr),
        loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=["accuracy"],
    )
    stop = keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience, restore_best_weights=True)
    classes = np.unique(y_tr)
    cw = dict(zip(classes.tolist(), compute_class_weight("balanced", classes=classes, y=y_tr)))
    return model.fit(X_tr, y_tr, validation_data=(X_va, y_va), epochs=epochs, batch_size=batch_size,
                     class_weight=cw, callbacks=[stop], verbose=verbose)


def predict(model, X):
    return model.predict(X, verbose=0, batch_size=256).argmax(axis=1)


def score(y_true, y_pred):
    return {"balanced_acc": round(float(balanced_accuracy_score(y_true, y_pred)), 3),
            "macro_f1": round(float(f1_score(y_true, y_pred, average="macro")), 3)}
```

| Setting | Value |
|---|---|
| Software | Python 3.12, TensorFlow 2.21.0, Keras 3.15.1, CPU only |
| Loss | sparse categorical cross-entropy on logits |
| Optimizer | Adam; learning rate 0.001 from zero, 0.0003 when fine-tuning |
| Batch size | 32 or 64 |
| Early stopping | validation loss, patience 8, keep the best weights |
| Class weights | balanced, computed from each training set |
| Seed | 42 |
| Metrics | balanced accuracy (guessing = 33 %) and macro F1 |

### Pre-training and fine-tuning

```python
# Pre-train: synthetic windows only
X_synth, y_synth = D.synthetic_patch_windows(np.random.default_rng(1))
m = M.build_transformer()
M.train(m, X_synth[rest], y_synth[rest], X_synth[hold], y_synth[hold], epochs=20, batch_size=64, patience=3)
m.save_weights("../models/pretrained_transformer.weights.h5")

# Fine-tune: same layers, start from those weights, smaller learning rate
m = M.build_transformer()
m.load_weights("../models/pretrained_transformer.weights.h5")
M.train(m, X_real_train, y_real_train, X_real_val, y_real_val, batch_size=64, lr=3e-4)
```

### Final training

```python
FINAL = "last-frames"     # the winner. Use "transformer" to serve the Transformer instead
final = BUILDERS[FINAL]()
final.load_weights(weights_path(FINAL))
M.train(final, X[~va], y[~va], X[va], y[va], batch_size=64, lr=3e-4)   # 6 people kept out for early stopping
final.save("../models/posture.keras")
```

The final model trains on everyone, so it has no unseen people left. Its accuracy is the cross-validated 84.7 %, not a test on its own training data.

### Why training happens more than once

The design stays the same; only the weights change. Weights must be found again whenever the input or the data changes. Lesson 1 kept its weights only in memory, and whole-bed weights do not fit the patch. Lesson 6 trains the final model once and saves it. After that the service only loads the file.

---

## 8. Results, lesson by lesson

### Lesson 1 · One mat, whole bed (13 people, leave-one-person-out)

Baseline 96.7 % ± 4.4, Transformer 96.1 % ± 5.9. Tied: people lie still.

### Lesson 2 · Two mats, whole bed

| Test | Baseline | Transformer |
|---|---|---|
| Trained on PmatData, tested on PoPu | 53.0 % | 55.2 % |
| Trained on PoPu, tested on PmatData | 75.6 % | 72.2 % |
| Combined, 73 unseen people | 95.6 % | 96.5 % |

### Lesson 3 · The 30×30 cm patch (73 people, 5-fold)

| Setup | Baseline | Transformer |
|---|---|---|
| Whole bed | 95.6 % | 96.5 % |
| Patch | 76.8 % | 75.1 % |
| Patch, PmatData people | 63.3 % | 65.9 % |
| Patch, PoPu people | 89.3 % | 84.9 % |
| Patch with placement error, trained for it | 77.6 % | 78.0 % |

Left and right swapped in 22.2 % (baseline) and 18.4 % (Transformer) of side windows. Placement error did not hurt: it worked like data augmentation.

### Lesson 4 · Real movement (60 people, 3-fold, 4 postures)

| View | Model | All | Still | Moving |
|---|---|---|---|---|
| Patch | baseline | 78.4 % | 84.6 % | 60.9 % |
| Patch | last-frames | 86.5 % | 84.1 % | 93.0 % |
| Patch | Transformer | 86.4 % | 86.6 % | 87.3 % |
| Whole bed | baseline | 90.3 % | 92.1 % | 86.5 % |
| Whole bed | last-frames | 94.7 % | 93.9 % | 96.5 % |
| Whole bed | Transformer | 94.9 % | 94.9 % | 95.3 % |

Turn detection on 12 unseen people, 36 real turns, patch:

| Hold | Last-frames: found / false alarms per hour | Transformer: found / false alarms per hour |
|---|---|---|
| 1 s | 36 / 116.6 | 36 / 83.0 |
| 10 s | 31 / 23.4 | 33 / 15.7 |
| 20 s | 30 / 12.6 | 28 / 9.9 |
| 30 s | 28 / 5.6 | 24 / 7.4 |

The hold rule:

```python
def detect_turns(states, hold):
    """Return (second, new state). A change counts only after `hold` seconds in a row."""
    current, run_state, run, events = states[0], states[0], 0, []
    for t, s in enumerate(states):
        run = run + 1 if s == run_state else 1
        run_state = s
        if s != current and run >= hold:
            events.append((t, int(s)))
            current = s
    return events
```

### Lesson 5 · Synthetic pre-training (19 unseen people, 3 random groups, Transformer)

| Real people for training | From zero | Pre-trained |
|---|---|---|
| 0 (synthetic only) | — | 56.5 % |
| 2 | 40.3 % ± 8.8 | 62.5 % ± 0.6 |
| 5 | 47.8 % ± 4.6 | 65.4 % ± 1.3 |
| 10 | 56.2 % ± 6.9 | 72.7 % ± 1.3 |
| 20 | 65.7 % ± 6.7 | 72.1 % ± 4.5 |
| 48 | 72.4 % ± 3.1 | 81.1 % ± 1.7 |

These are still windows only.

### Lesson 6 · The final recipe (73 people, 5-fold, patch with placement error, includes real turns)

| Model | Start | All | Macro F1 | Still | Moving | PmatData | PoPu | Left/right swapped |
|---|---|---|---|---|---|---|---|---|
| baseline | from zero | 73.9 % | 0.739 | 76.9 % | 66.4 % | 53.8 % | 79.1 % | 17.0 % |
| baseline | pre-trained | 76.4 % | 0.764 | 81.0 % | 64.5 % | 58.7 % | 80.9 % | 14.8 % |
| last-frames | from zero | 80.8 % | 0.807 | 77.3 % | 91.3 % | 56.2 % | 86.8 % | 11.3 % |
| **last-frames** | **pre-trained** | **84.7 %** | **0.847** | **81.7 %** | **94.2 %** | **61.9 %** | **90.1 %** | **9.4 %** |
| Transformer | from zero | 80.1 % | 0.802 | 77.2 % | 90.7 % | 60.6 % | 85.2 % | 11.9 % |
| Transformer | pre-trained | 80.8 % | 0.807 | 80.1 % | 84.0 % | 60.5 % | 86.0 % | 12.1 % |

The data has 5,834 windows, 1,359 of them with a real turn.

- **Last-frames with pre-training wins** on almost every column, and it is 11 times smaller than the Transformer.
- **Pre-training helped every model on still windows** (by 3–5 points).
- **It hurt the Transformer on moving windows** (90.7 → 84.0 %). A likely reason: synthetic windows are one frame repeated 30 times, so the Transformer learns that all seconds look alike. This was not tested further. Pre-training with fake turns is the obvious next experiment.
- **The decision follows the team plan:** *"Baseline first; the Transformer only if it beats the baseline on people it never saw."* It beat the plan's averaging baseline but lost to a fair simple competitor.
- **PmatData people stay hard** (about 60 %), far below PoPu people (about 90 %). The accuracy on a new kind of mat could be nearer the lower number.

---

## 9. The service

`ai/serve.py`. Run from the `ai` folder:

```bash
.venv/Scripts/python.exe -m uvicorn serve:app --port 8000
```

```python
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
```

The request flow: the server sends the last 30 frames (100 bytes each) → wrong shape gives error 422 → empty rule → flip and scale → model → posture and probabilities. The model file lives in `ai/models/` (not in git). Rebuild it by running notebook 06. We tested the service with FastAPI's test client: health check, predictions, wrong input size (error 422) and a near-empty mat.

**Live check.** We started the real service and sent it the average map of each posture from each dataset, in the mat's column order. It answered 5 of 6 correctly and in the right direction (pressure on the low columns = left). The miss: PmatData's average "left" came back as supine. This only shows that the service and the left/right flip work. The accuracy is the 84.7 % above.

**Not built yet:** the Express server does not call this service yet.

---

## 10. Honest limits

- **Never tested on our mat.** Every number is from hospital mats. A new mat cost 20–40 points in Lesson 2.
- **Left and right are the weak point.** Do not let the dashboard trust them without a confidence check.
- **Healthy volunteers**, moving on request. No patients, no nurse-assisted turns.
- **One fixed order** in PoPu sessions (supine → prone → left → right). The model may partly learn that order.
- **Single runs.** Lessons 2–4 and 6 use one seed. Differences of 1–2 points are noise.
- **Sensor spacing and PoPu timing are our own measurements**, not published values.
- **Turn events are not ready to run alone:** even the calmest setting gave a false turn about every 10 minutes.
- **The empty threshold and hold time are placeholders**, to be chosen by the team and kept in settings.
- **Prone is not a class** in the final model.

---

## 11. What the team should do next

| Priority | Task | Why |
|---|---|---|
| 1 | Record a few people on our mat; check left/right direction and the empty level | The only way to get our real accuracy |
| 2 | Fine-tune the pre-trained model on those recordings; report that score separately | Lesson 5 shows even 5 people help a lot |
| 3 | Connect Express to the service: keep 1 frame per second, send the last 30 | The service is ready, the server is not |
| 4 | Put turn logic with a hold time on the server | Lesson 4 |
| 5 | Test a bigger mat or another position (Lesson 3 exercises) | A hardware decision worth making with data |
| 6 | Try synthetic pre-training with fake turns | It may bring the Transformer back |
| 7 | Fix the zone layout | `server/data/cellLayout.ts` names head-to-heel zones on a mat that only sits under the lower back |

**A decision for the team:** the project and poster describe a Transformer, but the evidence favours the smaller model. Options: serve the small model and present the Transformer as the tested alternative (what this report does), or serve the Transformer and accept 3.9 points less. The small model is also about 27 KB, so it might fit on the ESP32 (not tested).

---

## 12. Suggested slides

1. **The question:** can 30 seconds of a 10×10 mat tell supine, left and right?
2. **Data reality check:** 5 datasets planned, what each really contained (section 2).
3. **Look before you train:** startup spikes, mirrored datasets, a stray cell on an empty bed (section 4, steps 3, 5, 6).
4. **Pipeline:** one picture of section 3.
5. **Our mat sees a quarter of the body:** patch picture, 96 % → 78 % (Lesson 3).
6. **The Transformer we built:** frames as tokens, attention, 75,651 parameters (section 6).
7. **Does attention help?** Averaging fails on real turns; last-frames does not (Lesson 4).
8. **Pre-training:** the learning curve from Lesson 5.
9. **The fair final test:** a model 11× smaller wins, 84.7 % against 80.8 %, plus honest limits (sections 8 and 10).
10. **Next:** our own mat (section 11).

---

## 13. References

1. M. B. Pouyan, J. Birjandtalab, M. Heydarzadeh, M. Nourani, S. Ostadabbas, "A pressure map dataset for posture and subject analytics," *IEEE EMBS BHI*, 2017. doi:10.1109/BHI.2017.7897206. Data: PhysioNet, PmatData v1.0.0.
2. A. L. Goldberger et al., "PhysioBank, PhysioToolkit, and PhysioNet," *Circulation*, vol. 101, no. 23, 2000.
3. L. Fonseca et al., "PoPu-Data: A multilayered, simultaneously collected lying position dataset," *Data*, vol. 8, no. 7, p. 120, 2023. doi:10.3390/data8070120.
4. H. M. Clever, P. Grady, G. Turk, C. C. Kemp, "BodyPressure: Inferring body pose and contact pressure from a depth image," *IEEE TPAMI*, vol. 45, no. 1, 2023. doi:10.1109/TPAMI.2022.3158902. Data: doi:10.7910/DVN/C6J1SP.
5. A. Vaswani et al., "Attention is all you need," *NeurIPS*, 2017.
