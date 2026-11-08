import pandas as pd
import matplotlib.pyplot as plt

from config.settings import CHARTS, THRESHOLDS
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, save_fig

ACTIONS = {
    "SUSPECTED_ABUSE": "Hold the refund for manual review",
    "MODEL_RISK": "Add to the review queue this week",
    "NEGATIVE_AFTER_RETURN": "Check return policy and restocking fee for this item",
    "HIGH_COST_TO_SERVE": "Move to a cheaper return method or charge the label fee",
    "REPEAT_RETURNER": "Put the account on a watch list and review its history",
    "LOW_RECOVERY": "Send to vendor credit or liquidation instead of the shelf",
    "UNUSUAL_RETURN": "Check order and return details by hand",
}


def assign_alert(row):
    alerts = []
    if row["abuse_flag"] >= 1:
        alerts.append("SUSPECTED_ABUSE")
    elif row["prob"] >= THRESHOLDS["model_risk_prob"]:
        alerts.append("MODEL_RISK")
    if row["profit_after"] < 0:
        alerts.append("NEGATIVE_AFTER_RETURN")
    if row["cost_ratio"] >= THRESHOLDS["cost_ratio_alert"]:
        alerts.append("HIGH_COST_TO_SERVE")
    if row["returns"] >= THRESHOLDS["repeat_returner_min"]:
        alerts.append("REPEAT_RETURNER")
    if row["recovery"] < THRESHOLDS["low_recovery_rate"]:
        alerts.append("LOW_RECOVERY")
    if row["anomaly"] >= 1:
        alerts.append("UNUSUAL_RETURN")
    return "|".join(alerts) if alerts else "NORMAL"


def priority_level(alerts):
    if alerts == "NORMAL":
        return "P4_ROUTINE"
    parts = alerts.split("|")
    abuse = "SUSPECTED_ABUSE" in parts
    if (abuse and "NEGATIVE_AFTER_RETURN" in parts) or len(parts) >= 4:
        return "P1_URGENT"
    if abuse or len(parts) >= 3 or ("NEGATIVE_AFTER_RETURN" in parts and "HIGH_COST_TO_SERVE" in parts):
        return "P2_HIGH"
    return "P3_MEDIUM"


def recommend(alerts):
    if alerts == "NORMAL":
        return "No action needed"
    return "; ".join(ACTIONS[a] for a in alerts.split("|"))


def working_frame(df, N):
    def col(key, default):
        return pd.to_numeric(df[N[key]], errors="coerce").fillna(default) if key in N else pd.Series(default, index=df.index)
    w = pd.DataFrame({"abuse_flag": col("abuse_flag", 0), "profit_after": col("profit_after", 0.0),
                      "returns": col("customer_returns", 0)})
    w["cost_ratio"] = df["return_cost_ratio"].fillna(0) if "return_cost_ratio" in df.columns else 0.0
    w["recovery"] = df["recovery_rate"].fillna(1.0) if "recovery_rate" in df.columns else 1.0
    w["prob"] = df["pred_prob"].fillna(0) if "pred_prob" in df.columns else 0.0
    w["anomaly"] = df["is_anomaly"].fillna(0) if "is_anomaly" in df.columns else 0
    return w


def run(verbose=True):
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    for key in ("predictions", "segments"):
        if P.FILES[key].exists():
            extra = pd.read_csv(P.FILES[key])
            df = df.merge(extra, on="row_id", how="left")
    w = working_frame(df, N)
    alerts = [assign_alert(r) for r in w.to_dict("records")]
    out = pd.DataFrame({"row_id": df["row_id"], "return_id": df[N["return_id"]], "alerts": alerts})
    out["priority"] = out["alerts"].map(priority_level)
    out["recommendations"] = out["alerts"].map(recommend)
    out["profit_lost"] = pd.to_numeric(df[N["profit_lost"]], errors="coerce").values
    out["abuse_flag"] = w["abuse_flag"].values
    out.to_csv(P.FILES["actions"], index=False, encoding="utf-8")
    counts = out["priority"].value_counts().reindex(["P1_URGENT", "P2_HIGH", "P3_MEDIUM", "P4_ROUTINE"]).fillna(0).astype(int)
    fig, ax = plt.subplots(figsize=(7, 4))
    bars = ax.bar(counts.index, counts.values, color=["#c0504d", "#e0803a", "#e0b030", "#4c9f70"])
    ax.bar_label(bars)
    ax.set_title("Returns by priority")
    save_fig(fig, P.REPORTS_DIR / CHARTS["priority"])
    if verbose:
        print("Priority counts:", counts.to_dict())
        print("Suspected abuse rate by priority:", out.groupby("priority")["abuse_flag"].mean().round(3).to_dict())
    return out
