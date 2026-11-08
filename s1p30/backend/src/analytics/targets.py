import pandas as pd

from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, read_json, save_json

DEFAULT_GOALS = {
    "profit_loss_cap": {"value": None, "unit": "monthly", "client_sets": True,
                        "description": "Highest acceptable profit lost to returns per month"},
    "abuse_rate_ceiling": {"value": None, "unit": "percent", "client_sets": True,
                           "description": "Highest acceptable share of suspected abuse returns"},
    "alert_rise_pct": {"value": 20, "unit": "percent", "description": "Alert if weekly profit lost rises by this much"},
    "forecast_horizon": {"value": 30, "unit": "days"},
}


def load_goals():
    existing = read_json(P.GOALS_FILE, None)
    if isinstance(existing, dict) and existing:
        return existing
    save_json(DEFAULT_GOALS, P.GOALS_FILE)
    return DEFAULT_GOALS


def run(verbose=True):
    goals = load_goals()
    if verbose:
        print("Goals in use:", {k: v.get("value") for k, v in goals.items()})
    return goals


def progress(df, N, goals):
    d = pd.to_datetime(df[N["return_date"]], errors="coerce")
    loss = pd.to_numeric(df[N["profit_lost"]], errors="coerce").fillna(0)
    monthly = loss.groupby(d.dt.to_period("M")).sum()
    weekly = loss.groupby(d.dt.to_period("W")).sum()
    out = {"months_observed": int(len(monthly))}
    cap = (goals.get("profit_loss_cap") or {}).get("value")
    latest = float(monthly.iloc[-1]) if len(monthly) else 0.0
    out["latest_month"] = str(monthly.index[-1]) if len(monthly) else None
    out["latest_month_profit_lost"] = round(latest, 2)
    out["profit_loss_cap"] = cap
    out["cap_status"] = ("not set" if cap in (None, 0) else ("over cap" if latest > cap else "within cap"))
    ceiling = (goals.get("abuse_rate_ceiling") or {}).get("value")
    rate = float(pd.to_numeric(df[N["abuse_flag"]], errors="coerce").fillna(0).clip(0, 1).mean() * 100)
    out["abuse_rate_pct"] = round(rate, 2)
    out["abuse_ceiling_pct"] = ceiling
    out["abuse_status"] = "not set" if ceiling in (None, 0) else ("over ceiling" if rate > ceiling else "within ceiling")
    rise = (goals.get("alert_rise_pct") or {}).get("value", 20)
    alert = None
    if len(weekly) >= 2 and weekly.iloc[-2] > 0:
        change = (weekly.iloc[-1] - weekly.iloc[-2]) / weekly.iloc[-2] * 100
        alert = {"week": str(weekly.index[-1]), "change_pct": round(float(change), 1), "threshold_pct": rise,
                 "triggered": bool(change >= rise)}
    out["weekly_alert"] = alert
    return out
