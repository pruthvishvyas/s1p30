import re

import pandas as pd

from config.settings import COLUMNS, PII_TOKENS
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import read_table, save_json

EMAIL_RX = re.compile(r"^[\w.+-]+@[\w-]+\.[\w.]+$")
PHONE_RX = re.compile(r"^\+?\d[\d\s().-]{8,}$")


def pii_columns(df, mapped):
    found = []
    for c in df.columns:
        if c in mapped:
            continue
        tokens = set(re.split(r"[^a-z0-9]+", str(c).lower()))
        if tokens & set(PII_TOKENS):
            found.append(c)
            continue
        if df[c].dtype == object:
            s = df[c].dropna().astype(str).head(200)
            if len(s) and (s.map(lambda v: bool(EMAIL_RX.match(v))).mean() > 0.5
                           or s.map(lambda v: bool(PHONE_RX.match(v))).mean() > 0.5):
                found.append(c)
    return found


def run(verbose=True):
    P.ensure_dirs()
    path = P.raw_input_file()
    df = read_table(path)
    N = resolve_columns(df, quiet=not verbose)
    mapped = set(N.values())
    pii = pii_columns(df, mapped)

    nulls = {c: int(n) for c, n in df.isnull().sum().items() if n > 0}
    cats = {N[k]: df[N[k]].astype(str).value_counts().head(12).to_dict()
            for k in ("category", "reason", "customer_type", "country", "method", "condition", "disposition")
            if k in N}
    target = N["abuse_flag"]
    balance = df[target].value_counts(dropna=False).to_dict()

    issues = {}
    od = pd.to_datetime(df[N["order_date"]], errors="coerce")
    rd = pd.to_datetime(df[N["return_date"]], errors="coerce")
    issues["unparsed_dates"] = int(od.isna().sum() + rd.isna().sum())
    issues["return_before_order"] = int((rd < od).sum())
    if "quantity" in N:
        issues["non_positive_quantity"] = int((pd.to_numeric(df[N["quantity"]], errors="coerce") <= 0).sum())
    if "discount_pct" in N:
        d = pd.to_numeric(df[N["discount_pct"]], errors="coerce")
        issues["discount_outside_0_100"] = int(((d < 0) | (d > 100)).sum())
    issues["duplicate_return_ids"] = int(df[N["return_id"]].duplicated().sum())

    record = {
        "source_file": path.name, "rows": int(len(df)), "columns": int(df.shape[1]),
        "nulls": nulls, "dtypes": {c: str(t) for c, t in df.dtypes.items()},
        "value_counts": cats, "target": target, "target_balance": {str(k): int(v) for k, v in balance.items()},
        "issues": issues, "pii_columns_found": pii,
        "pii_decision": "dropped from clean data and never exported" if pii else "none found",
        "schema_ok": True,
    }
    save_json(record, P.FILES["validation"])
    if verbose:
        print("Rows:", len(df), " Columns:", df.shape[1])
        print("Columns with nulls:", nulls if nulls else "none")
        print("Target balance:", record["target_balance"])
        print("Data checks:", issues)
        print("Personal data columns:", pii if pii else "none found")
    return record
