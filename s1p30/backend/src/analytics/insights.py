import pandas as pd

from config.settings import CURRENCY, THRESHOLDS
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, read_json, save_json

ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}


def _money(x):
    return CURRENCY + format(x, ",.0f")


def run(verbose=True):
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    for key in ("predictions", "segments", "actions"):
        if P.FILES[key].exists():
            extra = pd.read_csv(P.FILES[key])
            df = df.merge(extra[[c for c in extra.columns if c not in df.columns or c == "row_id"]], on="row_id", how="left")
    loss = pd.to_numeric(df[N["profit_lost"]], errors="coerce").fillna(0)
    flag = pd.to_numeric(df[N["abuse_flag"]], errors="coerce").fillna(0).clip(0, 1)
    n, total = len(df), float(loss.sum())
    items = []

    def add(category, finding, evidence, action, severity):
        items.append({"severity": severity, "category": category, "finding": finding,
                      "evidence": evidence, "action": action, "outcome": "decide"})

    def share(x):
        return x / total if total > 0 else 0.0

    if "profit_after" in N:
        neg = pd.to_numeric(df[N["profit_after"]], errors="coerce") < 0
        add("Revenue Leakage", "Returns erase profit on a large share of returned orders",
            f"{_money(total)} of profit lost across {n:,} returns; {int(neg.sum()):,} returns ({neg.mean():.1%}) end below zero profit",
            "Review the return policy for the items with the largest losses and set a restocking fee this week", "HIGH")
    cat = loss.groupby(df[N["category"]]).sum().sort_values(ascending=False)
    add("Product Performance", f"{cat.index[0]} is the category with the largest profit lost",
        f"{_money(cat.iloc[0])} lost, {share(cat.iloc[0]):.1%} of the total of {_money(total)}",
        f"Check quality, description and sizing issues in {cat.index[0]} and tighten its return terms", "HIGH")
    fn = int(flag.sum())
    add("Return Abuse", "A visible group of returns is flagged as suspected abuse",
        f"{fn:,} of {n:,} returns ({fn / n:.1%}) carry the flag and account for {_money(loss[flag == 1].sum())} ({share(loss[flag == 1].sum()):.1%} of profit lost)",
        "Send the flagged returns to manual review before refunds are paid", "HIGH")
    rs = loss.groupby(df[N["reason"]]).sum().sort_values(ascending=False)
    add("Return Reasons", f"'{rs.index[0]}' is the most costly return reason",
        f"{_money(rs.iloc[0])} lost, {share(rs.iloc[0]):.1%} of profit lost",
        "Fix the cause behind this reason in listings or packaging and report it again next week", "MEDIUM")
    if "return_cost" in df.columns:
        ov = pd.to_numeric(df[N["order_value"]], errors="coerce").sum()
        ratio = float(df["return_cost"].sum() / ov) if ov > 0 else 0.0
        hi = int((df["return_cost_ratio"] >= THRESHOLDS["cost_ratio_alert"]).sum())
        add("Cost Control", "Shipping and handling take a measurable part of returned order value",
            f"Handling and shipping equal {ratio:.1%} of returned order value ({_money(df['return_cost'].sum())} of {_money(ov)}); {hi:,} returns cost over a quarter of their value",
            "Renegotiate the return carrier rate and steer high-cost returns to drop-off", "MEDIUM")
    if "recovery_rate" in df.columns:
        low = int((df["recovery_rate"] < THRESHOLDS["low_recovery_rate"]).sum())
        add("Inventory Recovery", "Many returned items bring back almost none of their cost",
            f"{low:,} of {n:,} returns ({low / n:.1%}) recover under {THRESHOLDS['low_recovery_rate']:.0%} of item cost",
            "Route low recovery items to vendor credit or liquidation instead of restocking", "MEDIUM")
    if "repeat_returner_flag" in df.columns:
        rep = df["repeat_returner_flag"] == 1
        add("Customer Retention", "Accounts with repeated returns carry a disproportionate loss",
            f"{int(rep.sum()):,} returns ({rep.mean():.1%}) come from accounts with {THRESHOLDS['repeat_returner_min']}+ returns and hold {share(loss[rep].sum()):.1%} of profit lost",
            "Contact these accounts about fit and expectations and watch their next orders", "MEDIUM")
    if "is_anomaly" in df.columns:
        an = df["is_anomaly"] == 1
        add("Return Abuse", "Statistically unusual returns hold more loss than their count suggests",
            f"{int(an.sum()):,} unusual returns ({an.mean():.1%}) account for {share(loss[an].sum()):.1%} of profit lost",
            "Review the unusual returns list in the dashboard on Monday", "MEDIUM")
    metrics = read_json(P.FILES["metrics"], {}) or {}
    if metrics.get("test"):
        imp = (metrics.get("importances") or [{}])[0].get("feature", "n/a")
        verdict = "above" if metrics.get("beats_baseline") else "not above"
        add("Model Output", "The abuse model separates flagged from unflagged returns on unseen rows",
            f"Held-out AUC {metrics['test']['auc']:.2f} ({verdict} the naive 0.50); strongest signal: {imp}",
            "Use the score to order the review queue, not to decide refunds on its own", "LOW")
    if "fee_waived_flag" in df.columns:
        fw = df["fee_waived_flag"] == 1
        add("Policy", "Return label fees are often waived",
            f"{int(fw.sum()):,} of {n:,} returns ({fw.mean():.1%}) were charged no label fee",
            "Decide which return reasons should still carry a fee and apply it from next week", "LOW")
    if "country" in N:
        ctry = loss.groupby(df[N["country"]]).mean().sort_values(ascending=False)
        if len(ctry) > 1:
            add("Demand Patterns", f"{ctry.index[0]} has the highest average loss per return",
                f"{_money(ctry.iloc[0])} per return against {_money(ctry.iloc[-1])} in {ctry.index[-1]}",
                f"Review shipping and return terms for {ctry.index[0]}", "LOW")
    items.sort(key=lambda d: ORDER[d["severity"]])
    for i, it in enumerate(items):
        it["severity"] = "HIGH" if i < 3 else (it["severity"] if it["severity"] != "HIGH" else "MEDIUM")
    save_json(items, P.FILES["insights"])
    if verbose:
        for it in items:
            print("[" + it["severity"] + "]", it["category"] + ":", it["finding"])
            print("    evidence:", it["evidence"])
            print("    action:", it["action"])
    return items
