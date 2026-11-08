import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from config.settings import ANOMALY_CONTAMINATION, CHARTS, RANDOM_STATE
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, save_fig, save_json, save_model
from src.utils.runner import DataSizeSkip


def run(verbose=True):
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    keys = [k for k in ("order_value", "days_to_return", "profit_lost", "customer_returns", "discount_pct", "processing_days") if k in N]
    cols = [N[k] for k in keys]
    if "return_cost_ratio" in df.columns:
        cols.append("return_cost_ratio")
    if len(cols) < 3 or len(df) < 30:
        raise DataSizeSkip("not enough numeric columns or rows for segmentation")
    X = df[cols].apply(pd.to_numeric, errors="coerce")
    X = X.fillna(X.median())
    Z = StandardScaler().fit_transform(X)

    km = KMeans(n_clusters=3, n_init=10, random_state=RANDOM_STATE)
    cl = km.fit_predict(Z)
    sample = np.random.RandomState(RANDOM_STATE).choice(len(Z), size=min(len(Z), 5000), replace=False)
    sil = float(silhouette_score(Z[sample], cl[sample]))
    score = df["return_risk_score"] if "return_risk_score" in df.columns else X.iloc[:, 0]
    means = pd.Series(score.values).groupby(cl).mean().sort_values()
    names = {c: lab for c, lab in zip(means.index, ["Low", "Medium", "High"])}
    seg = pd.Series(cl).map(names)

    iso = IsolationForest(contamination=ANOMALY_CONTAMINATION, random_state=RANDOM_STATE)
    anom = (iso.fit_predict(Z) == -1).astype(int)
    pcs = PCA(n_components=2, random_state=RANDOM_STATE).fit_transform(Z)

    flag = pd.to_numeric(df[N["abuse_flag"]], errors="coerce").fillna(0)
    rate_a, rate_n = float(flag[anom == 1].mean()) if anom.sum() else 0.0, float(flag[anom == 0].mean())
    out = pd.DataFrame({"row_id": df["row_id"], "segment": seg, "is_anomaly": anom,
                        "pc1": np.round(pcs[:, 0], 4), "pc2": np.round(pcs[:, 1], 4)})
    out.to_csv(P.FILES["segments"], index=False, encoding="utf-8")

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    colors = {"Low": "#4c9f70", "Medium": "#e0a030", "High": "#c0504d"}
    for lab, c in colors.items():
        m = (seg == lab).values
        axes[0].scatter(pcs[m, 0], pcs[m, 1], s=8, alpha=0.6, c=c, label=lab)
    axes[0].set_title("Segments by risk level")
    axes[0].legend()
    axes[1].scatter(pcs[anom == 0, 0], pcs[anom == 0, 1], s=8, alpha=0.4, c="#2f6f9f", label="Normal")
    axes[1].scatter(pcs[anom == 1, 0], pcs[anom == 1, 1], s=14, c="#c0504d", label="Unusual")
    axes[1].set_title("Unusual returns")
    axes[1].legend()
    save_fig(fig, P.REPORTS_DIR / CHARTS["segments"])
    save_model(km, P.FILES["segment_model"])
    save_model(iso, P.FILES["anomaly_model"])
    meta = {"features": cols, "silhouette": sil, "cluster_names": {str(k): v for k, v in names.items()},
            "anomaly_count": int(anom.sum()), "anomaly_abuse_rate": rate_a, "normal_abuse_rate": rate_n}
    save_json(meta, P.FILES["segment_meta"])
    if verbose:
        print("Silhouette:", round(sil, 3))
        print("Segment sizes:", seg.value_counts().to_dict())
        print("Unusual returns:", int(anom.sum()), "abuse rate", round(rate_a, 3), "vs", round(rate_n, 3), "otherwise")
    return out
