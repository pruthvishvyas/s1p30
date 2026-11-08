import datetime
import decimal
import hashlib
import json
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from src.utils import paths as P


def _prep(path):
    p = Path(path).resolve()
    if P.ROOT != p and P.ROOT not in p.parents:
        raise ValueError("refusing to write outside the project: " + str(p))
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def read_table(path):
    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path)
    else:
        df = None
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                df = pd.read_csv(path, encoding=enc)
                break
            except UnicodeDecodeError:
                continue
            except pd.errors.ParserError:
                break
        if df is None or df.shape[1] <= 1:
            for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
                try:
                    df = pd.read_csv(path, sep=None, engine="python", encoding=enc)
                    break
                except Exception:
                    continue
        if df is None:
            raise ValueError("Could not read " + path.name + " with any known encoding or delimiter")
    df.columns = [str(c).strip() for c in df.columns]
    df = df.loc[:, ~pd.Index(df.columns).str.startswith("Unnamed:")]
    return df.dropna(axis=0, how="all").dropna(axis=1, how="all")


def save_csv(df, path):
    p = _prep(path)
    try:
        df.to_csv(p, index=False, encoding="utf-8")
    except PermissionError:
        p = p.with_name(p.stem + "_" + datetime.datetime.now().strftime("%H%M%S") + p.suffix)
        df.to_csv(p, index=False, encoding="utf-8")
    return p


def _plain(obj):
    if isinstance(obj, dict):
        return {str(k): _plain(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_plain(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return [_plain(v) for v in obj.tolist()]
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        f = float(obj)
        return f if np.isfinite(f) else None
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if isinstance(obj, (pd.Timestamp, datetime.datetime, datetime.date)):
        return None if pd.isna(obj) else obj.isoformat()
    if isinstance(obj, pd.Period):
        return str(obj)
    if isinstance(obj, Path):
        return obj.name
    try:
        if obj is pd.NaT or (not isinstance(obj, (str, int)) and pd.isna(obj)):
            return None
    except (TypeError, ValueError):
        pass
    return obj


def save_json(obj, path):
    p = _prep(path)
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(_plain(obj), fh, indent=2, ensure_ascii=False)
    return p


def read_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def write_text(text, path):
    p = _prep(path)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(text.replace(chr(0xfffd), "-"))
    return p


def save_fig(fig, path):
    p = _prep(path)
    fig.tight_layout()
    fig.savefig(p, dpi=150, bbox_inches="tight", metadata={"Software": None})
    plt.close(fig)
    return p


def _sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def save_model(obj, path):
    p = _prep(path)
    joblib.dump(obj, p)
    reg_path = P.MODELS_DIR / "model_hashes.json"
    reg = read_json(reg_path, {})
    reg[p.name] = _sha(p)
    save_json(reg, reg_path)
    return p


def load_model(path):
    p = Path(path).resolve()
    if p.parent != P.MODELS_DIR.resolve():
        raise ValueError("models are only loaded from the project models folder")
    reg = read_json(P.MODELS_DIR / "model_hashes.json", {})
    if p.name in reg and reg[p.name] != _sha(p):
        raise ValueError("model file changed since it was saved: " + p.name)
    return joblib.load(p)


def load_required(path, producer):
    if not Path(path).exists():
        raise FileNotFoundError(Path(path).name + " is missing. Run the " + producer + " stage first.")
    return pd.read_csv(path)
