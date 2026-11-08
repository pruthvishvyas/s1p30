import pandas as pd

from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, save_json

SCENARIO_FILES = ["label_fee_change", "abuse_reduction", "recovery_uplift"]


def _num(df, N, key):
    return pd.to_numeric(df[N[key]], errors="coerce").fillna(0.0)


def run(verbose=True):
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    loss = _num(df, N, "profit_lost")
    n = len(df)
    flag = _num(df, N, "abuse_flag") >= 1

    # label fee: charge more per return, some customers stop returning
    if "label_fee" in N:
        fee = _num(df, N, "label_fee")
        avg_fee, deterrence_per_dollar = float(fee.mean()), 0.02
        pts = []
        for extra in (0, 1, 2, 3, 4, 5, 6, 8, 10):
            dropped = min(0.5, extra * deterrence_per_dollar)
            net = n * (1 - dropped) * extra + n * dropped * float(loss.mean())
            pts.append({"extra_fee": extra, "returns_avoided_pct": round(dropped * 100, 1), "net_profit_gain": round(net, 2)})
        save_json({"id": "label_fee_change", "title": "Raise the return label fee", "variable": "extra_fee",
                   "unit": "currency per return",
                   "assumptions": {"current_average_fee": round(avg_fee, 2),
                                   "deterrence": "2 percent of returns avoided per extra currency unit, capped at 50 percent",
                                   "avoided_returns_save": "average profit lost per return"},
                   "points": pts}, P.SIM_DIR / "label_fee_change.json")

    # abuse reduction: share of flagged losses removed by review or policy
    flagged_loss = float(loss[flag].sum())
    pts = [{"reduction_pct": r, "profit_saved": round(flagged_loss * r / 100, 2)} for r in range(0, 55, 5)]
    save_json({"id": "abuse_reduction", "title": "Reduce suspected abuse returns", "variable": "reduction_pct",
               "unit": "percent of flagged returns prevented",
               "assumptions": {"flagged_returns": int(flag.sum()), "flagged_profit_lost": round(flagged_loss, 2),
                               "note": "prevented returns save their full recorded profit loss"},
               "points": pts}, P.SIM_DIR / "abuse_reduction.json")

    # recovery uplift: close part of the gap between item cost and recovered value
    if all(k in N for k in ("recovery_value", "unit_cost", "quantity")):
        cost = _num(df, N, "unit_cost") * _num(df, N, "quantity")
        gap = float((cost - _num(df, N, "recovery_value")).clip(lower=0).sum())
        pts = [{"uplift_pct": u, "profit_saved": round(gap * u / 100, 2)} for u in range(0, 35, 5)]
        save_json({"id": "recovery_uplift", "title": "Recover more value from returned items", "variable": "uplift_pct",
                   "unit": "percent of the unrecovered cost gap closed",
                   "assumptions": {"unrecovered_cost_gap": round(gap, 2),
                                   "note": "gap is item cost minus recovery value, floored at zero"},
                   "points": pts}, P.SIM_DIR / "recovery_uplift.json")
    if verbose:
        print("Scenario files:", sorted(p.name for p in P.SIM_DIR.glob("*.json")))
