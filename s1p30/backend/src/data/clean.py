import re

import numpy as np
import pandas as pd

from config.settings import CATEGORY_KEYS, DATE_KEYS, NUMERIC_KEYS
from src.data.ingest import pii_columns
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import read_table, save_csv, save_json


def _to_number(s):
    if s.dtype == object:
        s = s.astype(str).str.replace(r"[$,%\s]", "", regex=True).replace({"": np.nan, "nan": np.nan})
    return pd.to_numeric(s, errors="coerce")


def _iqr_cap(s):
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    spread = q3 - q1
    lo, hi = q1 - 3 * spread, q3 + 3 * spread
    return s.clip(lo, hi), int(((s < lo) | (s > hi)).sum())


def run(verbose=True):
    df = read_table(P.raw_input_file())
    N = resolve_columns(df)
    raw_rows = len(df)
    log = {"raw_rows": int(raw_rows), "steps": []}

    drop_pii = [c for c in pii_columns(df, set(N.values()))]
    if drop_pii:
        df = df.drop(columns=drop_pii)
        log["steps"].append("dropped personal data columns: " + ", ".join(drop_pii))

    for c in df.columns:
        if df[c].dtype == object:
            df[c] = df[c].astype(str).str.strip().str.replace(r"\s+", " ", regex=True).replace({"nan": np.nan})

    coerced = 0
    for k in NUMERIC_KEYS:
        if k in N:
            before = df[N[k]].notna().sum()
            df[N[k]] = _to_number(df[N[k]])
            coerced += int(before - df[N[k]].notna().sum())
    log["steps"].append("numbers that could not be read and were blanked: " + str(coerced))

    bad_dates = 0
    for k in DATE_KEYS:
        if k in N:
            parsed = pd.to_datetime(df[N[k]], errors="coerce")
            bad_dates += int(parsed.isna().sum())
            df[N[k]] = parsed
    log["unparsed_dates"] = bad_dates

    n0 = len(df)
    df = df.dropna(subset=[N["return_id"], N["return_date"], N["order_date"]])
    log["steps"].append("dropped rows without return id or dates: " + str(n0 - len(df)))
    n0 = len(df)
    df = df.drop_duplicates(subset=[N["return_id"]], keep="first")
    removed_dupes = n0 - len(df)
    print("Duplicates removed:", removed_dupes) if verbose else None
    log["steps"].append("duplicate return ids removed: " + str(removed_dupes))

    n0 = len(df)
    bad = df[N["return_date"]] < df[N["order_date"]]
    if "quantity" in N:
        bad = bad | (df[N["quantity"]] <= 0)
    if "unit_price" in N:
        bad = bad | (df[N["unit_price"]] < 0)
    df = df[~bad]
    log["steps"].append("rows with impossible dates, quantities or prices removed: " + str(n0 - len(df)))

    # cap only the operational day counts; money columns are real losses and stay as recorded
    for k in ("days_to_return", "processing_days"):
        if k in N:
            capped, n_out = _iqr_cap(df[N[k]])
            if verbose:
                print(N[k], "outliers before:", n_out, "after: 0")
            df[N[k]] = capped
            log["steps"].append("capped " + N[k] + " outliers: " + str(n_out))

    for k in CATEGORY_KEYS:
        if k in N:
            col = df[N[k]].astype("string")
            canon = col.dropna().groupby(col.dropna().str.lower()).agg(lambda s: s.value_counts().index[0])
            df[N[k]] = col.str.lower().map(canon).where(col.notna())

    df = df.reset_index(drop=True)
    df["abuse_label"] = np.where(df[N["abuse_flag"]].fillna(0) >= 1, "Suspected abuse", "Not flagged")
    for k in DATE_KEYS:
        if k in N:
            df[N[k]] = df[N[k]].dt.strftime("%Y-%m-%d")

    log["clean_rows"] = int(len(df))
    log["removed_share"] = round(1 - len(df) / raw_rows, 4) if raw_rows else 0.0
    save_csv(df, P.FILES["clean"])
    save_json(log, P.FILES["cleaning_log"])
    if verbose:
        print("Rows before:", raw_rows, " after:", len(df))
    return df
