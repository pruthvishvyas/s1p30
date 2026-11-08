import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from config.settings import CHARTS
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, save_fig, save_json

plt.rcParams.update({"figure.dpi": 150, "axes.spines.top": False, "axes.spines.right": False})
BLUE, RED = "#2f6f9f", "#c0504d"


def _emit(fig, key, cid, title, kind, xl, yl, data, outcome):
    save_fig(fig, P.REPORTS_DIR / CHARTS[key])
    save_json({"id": cid, "title": title, "type": kind, "x_label": xl, "y_label": yl,
               "data": data, "outcome": outcome}, P.SPECS_DIR / (cid + ".json"))


def _flag(df, N):
    return pd.to_numeric(df[N["abuse_flag"]], errors="coerce").fillna(0).astype(int)


def _bar(df, N, key, cid, title, series, xl, yl, outcome, horizontal=False):
    series = series.sort_values(ascending=False).head(12)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    if horizontal:
        bars = ax.barh(series.index.astype(str)[::-1], series.values[::-1], color=BLUE)
    else:
        bars = ax.bar(series.index.astype(str), series.values, color=BLUE)
        plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    ax.bar_label(bars, labels=[f"{v:,.0f}" if abs(v) >= 10 else f"{v:.2f}" for v in (series.values[::-1] if horizontal else series.values)], padding=2, fontsize=8)
    ax.set_title(title)
    ax.set_xlabel(xl)
    ax.set_ylabel(yl)
    data = [{"label": str(k), "value": round(float(v), 4)} for k, v in series.items()]
    _emit(fig, key, cid, title, "bar", xl, yl, data, outcome)


def flag_distribution(df, N):
    s = df["abuse_label"].value_counts()
    _bar(df, N, "flag_distribution", "flag_distribution", "Returns by abuse flag", s, "Flag", "Returns", "understand")


def loss_by_reason(df, N):
    s = df.groupby(N["reason"])[N["profit_lost"]].sum()
    _bar(df, N, "loss_by_reason", "profit_lost_by_reason", "Profit lost by return reason", s,
         "Profit lost", "Reason", "understand", horizontal=True)


def loss_by_category(df, N):
    s = df.groupby(N["category"])[N["profit_lost"]].sum()
    _bar(df, N, "loss_by_category", "profit_lost_by_category", "Profit lost by category", s,
         "Category", "Profit lost", "understand")


def days_by_flag(df, N):
    d = pd.to_numeric(df[N["days_to_return"]], errors="coerce")
    flag = _flag(df, N)
    bins = np.linspace(d.min(), d.max(), 11)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.hist(d[flag == 0].dropna(), bins=bins, alpha=0.6, color=BLUE, label="Not flagged")
    ax.hist(d[flag == 1].dropna(), bins=bins, alpha=0.6, color=RED, label="Suspected abuse")
    ax.set_title("Days to return by abuse flag")
    ax.set_xlabel("Days to return")
    ax.set_ylabel("Returns")
    ax.legend()
    data = []
    for name, sub in (("Not flagged", d[flag == 0]), ("Suspected abuse", d[flag == 1])):
        counts, edges = np.histogram(sub.dropna(), bins=bins)
        data += [{"label": f"{int(edges[i])}-{int(edges[i + 1])} | {name}", "value": int(c)} for i, c in enumerate(counts)]
    _emit(fig, "days_by_flag", "days_to_return_by_flag", "Days to return by abuse flag", "histogram",
          "Days to return", "Returns", data, "understand")


def correlations(df, N):
    cols = [c for c in ("order_value", "unit_price", "discount_pct", "days_to_return", "processing_days",
                        "reverse_ship", "handling_cost", "profit_lost", "customer_returns", "abuse_flag") if c in N]
    sub = df[[N[c] for c in cols]].apply(pd.to_numeric, errors="coerce")
    corr = sub.corr()
    mask = np.triu(np.ones_like(corr, dtype=bool), k=1)
    fig, ax = plt.subplots(figsize=(8, 6.5))
    shown = corr.mask(mask)
    im = ax.imshow(shown, cmap="RdYlGn", vmin=-1, vmax=1)
    ax.set_xticks(range(len(cols)))
    ax.set_xticklabels(cols, rotation=45, ha="right", fontsize=8)
    ax.set_yticks(range(len(cols)))
    ax.set_yticklabels(cols, fontsize=8)
    for i in range(len(cols)):
        for j in range(i + 1):
            ax.text(j, i, f"{corr.iloc[i, j]:.2f}", ha="center", va="center", fontsize=7)
    fig.colorbar(im, ax=ax, shrink=0.7)
    ax.set_title("Correlation between key numbers")
    data = [{"label": cols[i] + " | " + cols[j], "value": round(float(corr.iloc[i, j]), 4)}
            for i in range(len(cols)) for j in range(i)]
    _emit(fig, "correlations", "correlation_heatmap", "Correlation between key numbers", "heatmap", "", "", data, "understand")


def abuse_by_reason(df, N):
    rate = df.assign(_f=_flag(df, N)).groupby(N["reason"])["_f"].mean()
    _bar(df, N, "abuse_by_reason", "abuse_rate_by_reason", "Suspected abuse rate by return reason", rate,
         "Reason", "Abuse rate", "decide")


def score_by_flag(df, N):
    flag = _flag(df, N)
    s = df["return_risk_score"]
    bins = np.linspace(0, 100, 11)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.hist(s[flag == 0], bins=bins, alpha=0.6, color=BLUE, label="Not flagged")
    ax.hist(s[flag == 1], bins=bins, alpha=0.6, color=RED, label="Suspected abuse")
    ax.set_title("Return risk score by abuse flag")
    ax.set_xlabel("Risk score")
    ax.set_ylabel("Returns")
    ax.legend()
    counts, edges = np.histogram(s, bins=bins)
    data = [{"label": f"{int(edges[i])}-{int(edges[i + 1])}", "value": int(c)} for i, c in enumerate(counts)]
    _emit(fig, "score_by_flag", "risk_score_histogram", "Return risk score distribution", "histogram",
          "Risk score", "Returns", data, "decide")


def price_vs_loss(df, N):
    sub = df.sample(min(len(df), 400), random_state=42)
    flag = _flag(sub, N)
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.scatter(sub[N["unit_price"]], sub[N["profit_lost"]], c=np.where(flag == 1, RED, BLUE), s=12, alpha=0.6)
    ax.set_title("Unit price against profit lost (red = suspected abuse)")
    ax.set_xlabel("Unit price")
    ax.set_ylabel("Profit lost")
    data = [{"label": str(round(float(x), 2)), "value": round(float(y), 2)}
            for x, y in zip(sub[N["unit_price"]], sub[N["profit_lost"]])]
    _emit(fig, "price_vs_loss", "price_vs_loss_scatter", "Unit price against profit lost", "scatter",
          "Unit price", "Profit lost", data, "decide")


def abuse_heatmap(df, N):
    tab = df.assign(_f=_flag(df, N)).pivot_table(index=N["category"], columns=N["customer_type"], values="_f", aggfunc="mean")
    fig, ax = plt.subplots(figsize=(7, 5))
    im = ax.imshow(tab.values, cmap="RdYlGn_r", aspect="auto")
    ax.set_xticks(range(tab.shape[1]))
    ax.set_xticklabels(tab.columns, rotation=30, ha="right")
    ax.set_yticks(range(tab.shape[0]))
    ax.set_yticklabels(tab.index)
    for i in range(tab.shape[0]):
        for j in range(tab.shape[1]):
            v = tab.values[i, j]
            if not np.isnan(v):
                ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=8)
    fig.colorbar(im, ax=ax, shrink=0.7)
    ax.set_title("Suspected abuse rate by category and customer type")
    data = [{"label": str(r) + " | " + str(c), "value": round(float(tab.loc[r, c]), 4)}
            for r in tab.index for c in tab.columns if not np.isnan(tab.loc[r, c])]
    _emit(fig, "abuse_heatmap", "abuse_rate_heatmap", "Suspected abuse rate by category and customer type", "heatmap",
          "Customer type", "Category", data, "monitor")


def weekly_trend(df, N):
    d = pd.to_datetime(df[N["return_date"]], errors="coerce")
    wk = df.groupby(d.dt.to_period("W").dt.start_time)[N["profit_lost"]].sum()
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.plot(wk.index, wk.values, color=BLUE, marker="o", markersize=3)
    ax.set_title("Weekly profit lost to returns")
    ax.set_xlabel("Week")
    ax.set_ylabel("Profit lost")
    data = [{"label": t.strftime("%Y-%m-%d"), "value": round(float(v), 2)} for t, v in wk.items()]
    _emit(fig, "weekly_trend", "weekly_profit_lost", "Weekly profit lost to returns", "line", "Week", "Profit lost", data, "monitor")


CHART_FUNCS = [flag_distribution, loss_by_reason, loss_by_category, days_by_flag, correlations,
               abuse_by_reason, score_by_flag, price_vs_loss, abuse_heatmap, weekly_trend]


def run(verbose=True):
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    done, skipped = [], {}
    for fn in CHART_FUNCS:
        try:
            fn(df, N)
            done.append(fn.__name__)
        except Exception as exc:
            skipped[fn.__name__] = str(exc)
    if verbose:
        print("Charts written:", len(done), done)
        if skipped:
            print("Charts skipped:", skipped)
    if len(done) < 7:
        raise RuntimeError("fewer than 7 charts could be drawn: " + str(skipped))
    return done
