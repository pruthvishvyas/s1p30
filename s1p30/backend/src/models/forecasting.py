import math

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from config.settings import CHARTS, RANDOM_STATE
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, read_json, save_fig, save_json, save_model
from src.utils.runner import DataSizeSkip


def _rows(y, t_from, t_to):
    X = [[y[t - 1], y[t - 2], y[t - 3], float(np.mean(y[t - 4:t])), t] for t in range(t_from, t_to)]
    return np.array(X), np.array(y[t_from:t_to])


def _mape(actual, pred):
    m = actual > 0
    return float(np.mean(np.abs(actual[m] - pred[m]) / actual[m])) if m.any() else float("nan")


def run(verbose=True):
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    d = pd.to_datetime(df[N["return_date"]], errors="coerce")
    wk = df.groupby(d.dt.to_period("W").dt.start_time)[N["profit_lost"]].sum()
    wk = wk.reindex(pd.date_range(wk.index.min(), wk.index.max(), freq="7D"), fill_value=0.0)
    y = wk.values.astype(float)
    n = len(y)
    if n < 12:
        raise DataSizeSkip("only " + str(n) + " weeks of history, forecast needs at least 12")
    hold = max(3, int(round(0.2 * n)))
    split = n - hold
    Xtr, ytr = _rows(y, 4, split)
    model = make_pipeline(StandardScaler(), Ridge(alpha=1.0, random_state=RANDOM_STATE))
    model.fit(Xtr, ytr)
    Xho, yho = _rows(y, split, n)
    pred = model.predict(Xho)
    base = y[split - 1:n - 1]
    mae_m, mae_b = float(np.mean(np.abs(yho - pred))), float(np.mean(np.abs(yho - base)))
    mape_m, mape_b = _mape(yho, pred), _mape(yho, base)

    goals = read_json(P.GOALS_FILE, {}) or {}
    horizon_days = (goals.get("forecast_horizon") or {}).get("value", 30)
    steps = max(1, math.ceil(horizon_days / 7))
    hist = list(y)
    future = []
    for i in range(steps):
        t = len(hist)
        x = np.array([[hist[t - 1], hist[t - 2], hist[t - 3], float(np.mean(hist[t - 4:t])), t]])
        v = max(0.0, float(model.predict(x)[0]))
        hist.append(v)
        future.append(v)

    kinds = ["train"] * split + ["holdout"] * hold
    out = pd.DataFrame({"week_start": wk.index.strftime("%Y-%m-%d"), "actual": np.round(y, 2),
                        "predicted": np.nan, "baseline": np.nan, "kind": kinds})
    out.loc[split:, "predicted"] = np.round(pred, 2)
    out.loc[split:, "baseline"] = np.round(base, 2)
    fut_dates = pd.date_range(wk.index[-1] + pd.Timedelta(days=7), periods=steps, freq="7D")
    fut = pd.DataFrame({"week_start": fut_dates.strftime("%Y-%m-%d"), "actual": np.nan,
                        "predicted": np.round(future, 2), "baseline": np.nan, "kind": "forecast"})
    out = pd.concat([out, fut], ignore_index=True)
    out.to_csv(P.FILES["forecast"], index=False, encoding="utf-8")

    fig, ax = plt.subplots(figsize=(9, 4.5))
    ax.plot(wk.index, y, color="#2f6f9f", label="Actual")
    ax.plot(wk.index[split:], pred, color="#c0504d", label="Model, one week ahead")
    ax.plot(fut_dates, future, "--", color="#c0504d", label="Forecast")
    ax.axvline(wk.index[split], color="grey", linestyle=":")
    ax.set_title("Weekly profit lost: held-out check and forecast")
    ax.legend()
    save_fig(fig, P.REPORTS_DIR / CHARTS["forecast"])
    save_model(model, P.FILES["forecast_model"])
    save_json({"series": "weekly profit lost", "weeks": n, "holdout_weeks": hold, "horizon_days": horizon_days,
               "evaluation": "one week ahead on the final weeks, chronological split",
               "model": {"name": "Ridge on four lags and trend", "mae": mae_m, "mape": mape_m},
               "baseline": {"name": "last week value", "mae": mae_b, "mape": mape_b},
               "beats_baseline": bool(mae_m < mae_b), "low_sample": bool(n < 26),
               "future": [{"week_start": str(a.date()), "predicted": round(b, 2)} for a, b in zip(fut_dates, future)]},
              P.FILES["forecast_metrics"])
    if verbose:
        print("Weeks:", n, " held-out weeks:", hold)
        print("Model MAE", round(mae_m, 2), "MAPE", round(mape_m, 3), "| last-value MAE", round(mae_b, 2), "MAPE", round(mape_b, 3))
    return out
