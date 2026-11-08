import numpy as np
import pandas as pd

from config.settings import THRESHOLDS
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, save_csv, save_json


def _ratio(num, den):
    return num / den.replace(0, 1)


def build_features(df, N):
    out = df.copy()
    made, skipped = [], {}

    def have(*keys):
        miss = [k for k in keys if k not in N]
        return not miss

    def num(key):
        return pd.to_numeric(out[N[key]], errors="coerce")

    def add(name, series, *keys):
        out[name] = series
        made.append(name)

    if have("discount_pct"):
        add("discount_band", pd.cut(num("discount_pct"), [-1, 0, 10, 20, 100],
                                    labels=["none", "1-10", "11-20", "over 20"]).astype(str))
    else:
        skipped["discount_band"] = "no discount column"
    if have("unit_price"):
        ranks = num("unit_price").rank(method="first")
        add("price_tier", pd.qcut(ranks, 4, labels=["budget", "mid", "upper", "premium"]).astype(str))
    else:
        skipped["price_tier"] = "no unit price column"
    if have("days_to_return"):
        d = num("days_to_return")
        add("return_speed_band", pd.cut(d, [-1, 3, 7, 14, 30, 10000],
                                        labels=["within 3 days", "4-7 days", "8-14 days", "15-30 days",
                                                "over 30 days"]).astype(str))
        add("fast_return_flag", (d <= THRESHOLDS["fast_return_days"]).astype(int))
    else:
        skipped["return_speed_band"] = "no days to return column"
    if have("order_value", "refund_amount"):
        add("refund_ratio", _ratio(num("refund_amount"), num("order_value")))
    if have("order_value", "reverse_ship", "handling_cost"):
        cost = num("reverse_ship") + num("handling_cost")
        if have("exchange_cost"):
            cost = cost + num("exchange_cost").fillna(0)
        add("return_cost", cost)
        add("return_cost_ratio", _ratio(cost, num("order_value")))
    else:
        skipped["return_cost_ratio"] = "shipping or handling column missing"
    if have("order_value", "sale_profit"):
        add("original_margin_pct", _ratio(num("sale_profit"), num("order_value")))
    if have("recovery_value", "unit_cost", "quantity"):
        add("recovery_rate", _ratio(num("recovery_value"), num("unit_cost") * num("quantity")).clip(0, 1))
    else:
        skipped["recovery_rate"] = "cost or recovery column missing"
    if have("order_value", "profit_lost"):
        add("loss_to_value", _ratio(num("profit_lost"), num("order_value")))
    if have("customer_returns"):
        add("repeat_returner_flag", (num("customer_returns") >= THRESHOLDS["repeat_returner_min"]).astype(int))
    if have("label_fee"):
        add("fee_waived_flag", (num("label_fee") == 0).astype(int))
    if have("order_value"):
        add("high_value_flag", (num("order_value") >= num("order_value").quantile(THRESHOLDS["high_value_quantile"])).astype(int))
    if have("condition"):
        add("opened_or_used_flag", (~out[N["condition"]].astype(str).str.contains("new", case=False)).astype(int))
    if have("return_date"):
        rd = pd.to_datetime(out[N["return_date"]], errors="coerce")
        add("return_weekday", rd.dt.dayofweek)
        add("weekend_return_flag", (rd.dt.dayofweek >= 5).astype(int))
        add("return_month_num", rd.dt.month)
    if have("discount_pct"):
        add("deep_discount_flag", (num("discount_pct") >= THRESHOLDS["deep_discount_pct"]).astype(int))

    # weights reflect how strongly each signal is tied to policy abuse in returns practice
    weights = {"fast_return_flag": 0.25, "deep_discount_flag": 0.15, "repeat_returner_flag": 0.30,
               "opened_or_used_flag": 0.15, "high_value_flag": 0.15}
    present = {k: w for k, w in weights.items() if k in out.columns}
    if present:
        total = sum(present.values())
        out["return_risk_score"] = 100 * sum(out[k] * w for k, w in present.items()) / total
        made.append("return_risk_score")
    else:
        skipped["return_risk_score"] = "no signals available"
    out.insert(0, "row_id", np.arange(len(out)))
    return out, made, skipped


def run(verbose=True):
    df = load_required(P.FILES["clean"], "cleaning")
    N = resolve_columns(df)
    feats, made, skipped = build_features(df, N)
    save_csv(feats, P.FILES["features"])
    save_json({"new_features": made, "skipped": skipped}, P.FILES["feature_log"])
    if verbose:
        print("New features:", made)
        if skipped:
            print("Skipped:", skipped)
    return feats
