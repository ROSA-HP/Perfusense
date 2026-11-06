"""Load, clean and shape the pressure datasets. Training and serving share this file.

Common picture format ("training view"), used for every dataset:
  rows    = head (row 0) to foot
  columns = PmatData's direction: a person lying on their left loads the HIGH columns.

Our server's zones put the patient's left in the LOW columns (server/lib/zones.ts), so frames from
our mat pass through mat_to_model() once on the way in. See Lessons 2 and 6.
"""
import json
import os
import pickle
import re
from pathlib import Path

import numpy as np
import pandas as pd

T = 30                      # frames per window: 30 s at 1 frame per second
GRID = 10                   # our mat is 10 x 10 cells
CLASSES = ["supine", "left", "right"]
CLASSES_WITH_PRONE = ["supine", "prone", "left", "right"]   # Lesson 4: PoPu sessions include prone

PMD_POSITION_TO_CLASS = {
    1: "supine", 8: "supine", 9: "supine", 10: "supine", 11: "supine", 12: "supine",
    15: "supine", 16: "supine", 17: "supine",
    2: "right", 4: "right", 5: "right", 13: "right",
    3: "left", 6: "left", 7: "left", 14: "left",
}
PMD_FLAT_SUPINE = (1, 8, 9, 10, 11, 12)


def data_root():
    """Folder that holds all datasets. Set PERFUSENSE_DATA to change it."""
    default = Path(__file__).resolve().parents[3] / "datasets"
    return Path(os.environ.get("PERFUSENSE_DATA", default))


def pmd_exp1_dir():
    return (data_root() / "pmd-1.0.0" / "a-pressure-map-dataset-for-in-bed-posture-classification-1.0.0"
            / "experiment-i")


def popu_dir():
    return data_root() / "PoPu-main" / "PoPu-main" / "PoPu_data" / "tactilus_data"


# ---------- cleaning and shaping (same steps as Lesson 1) ----------

def drop_bad_frames(frames, factor=3.0):
    """Remove frames whose total pressure is far from the recording's median."""
    total = frames.sum(axis=(1, 2))
    med = np.median(total)
    keep = (total < factor * med) & (total > med / factor)
    return frames[keep]


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


def normalise_window(x, eps=1e-6):
    """Scale a window to 0..1 by its own 99th percentile. Used in training AND serving."""
    top = float(np.percentile(x, 99))
    return np.clip(x / max(top, eps), 0.0, 1.0).astype("float32")


def mat_to_model(frames):
    """Frames from our mat (column 0 = patient's left) -> training view. Flips the columns."""
    return frames[..., ::-1]


def pad_to_width(frames, width=32):
    """Add empty columns on both sides, so a narrower mat keeps its real scale."""
    missing = width - frames.shape[2]
    left = missing // 2
    return np.pad(frames, ((0, 0), (0, 0), (left, missing - left)))


# ---------- PmatData Experiment I ----------

def load_pmd_file(path):
    """One PmatData Exp. I file -> (frames, 64, 32)."""
    table = pd.read_csv(path, sep=r"\s+", header=None).to_numpy(dtype="float32")
    return table.reshape(-1, 64, 32)


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


# ---------- PoPu ----------

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


# ---------- BodyPressureSD (synthetic, Lesson 5) ----------

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


# ---------- windows ----------

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


def whole_bed_view(recording):
    """The whole mat on a common 32-sensor width, averaged to 10 x 10."""
    return area_resize(pad_to_width(recording["frames"]))


# ---------- the 30 x 30 cm patch (Lesson 3) ----------

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
