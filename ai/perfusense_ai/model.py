"""The models from Lesson 1, plus training and scoring helpers."""
import keras
import numpy as np
import tensorflow as tf
from keras import layers
from sklearn.metrics import balanced_accuracy_score, f1_score
from sklearn.model_selection import GroupKFold
from sklearn.utils.class_weight import compute_class_weight


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


def predict(model, X):
    return model.predict(X, verbose=0, batch_size=256).argmax(axis=1)


def score(y_true, y_pred):
    return {"balanced_acc": round(float(balanced_accuracy_score(y_true, y_pred)), 3),
            "macro_f1": round(float(f1_score(y_true, y_pred, average="macro")), 3)}
