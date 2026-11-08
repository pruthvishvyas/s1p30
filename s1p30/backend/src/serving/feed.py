import hashlib
import json
import os

import pandas as pd

from config.settings import (BIGQUERY, CLIENT_ID, DESCRIPTION, DOMAIN, EXPORT_ROW_CAP, ID_SALT, PROJECT_TITLE,
                             TERMINOLOGY)
from src.analytics import targets as goals_mod
from src.analytics import what_if as scenarios_mod
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, read_json, save_json
from src.utils.runner import update_run_log

O = P.OUTPUT_DIR


def _hash_id(v):
    return hashlib.sha256((ID_SALT + str(v)).encode("utf-8")).hexdigest()[:12]


def _bigquery_available():
    if not BIGQUERY["project_id"] or not BIGQUERY["dataset"]:
        return False
    cred = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or (
        str(P.ROOT / BIGQUERY["credentials_file"]) if (P.ROOT / BIGQUERY["credentials_file"]).exists() else "")
    if not cred:
        return False
    try:
        import google.cloud.bigquery  # noqa: F401
        return True
    except ImportError:
        return False


def _load_from_bigquery(config):
    from google.cloud import bigquery
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        client = bigquery.Client(project=config["project_id"])
    else:
        client = bigquery.Client.from_service_account_json(str(P.ROOT / config["credentials_file"]), project=config["project_id"])
    sql = "select * from `" + config["project_id"] + "." + config["dataset"] + "." + config["table"] + "`"
    print("Source: BigQuery")
    return client.query(sql).to_dataframe()


def _load_from_csv(config):
    print("Source: CSV")
    return load_required(P.FILES["features"], "feature")


def _load_data(config):
    df, source = None, "csv"
    if _bigquery_available():
        try:
            df = _load_from_bigquery(config)
            source = "bigquery"
        except Exception as exc:
            print("BigQuery failed, using CSV instead:", exc)
    if df is None:
        df = _load_from_csv(config)
    for key in ("predictions", "segments", "actions"):
        if P.FILES[key].exists() and "row_id" in df.columns:
            extra = pd.read_csv(P.FILES[key])
            df = df.merge(extra[[c for c in extra.columns if c not in df.columns or c == "row_id"]], on="row_id", how="left")
    return df, source


def _pct(a, b):
    return round(float(a) / float(b if b > 0 else 1), 4)


def _spec(cid, title, kind, xl, yl, data, outcome):
    return {"id": cid, "title": title, "type": kind, "x_label": xl, "y_label": yl, "data": data, "outcome": outcome}


def export_all(verbose=True):
    P.ensure_dirs()
    df, source = _load_data(BIGQUERY)
    N = resolve_columns(df)
    n = len(df)
    loss = pd.to_numeric(df[N["profit_lost"]], errors="coerce").fillna(0)
    flag = pd.to_numeric(df[N["abuse_flag"]], errors="coerce").fillna(0).clip(0, 1)
    value = pd.to_numeric(df[N["order_value"]], errors="coerce").fillna(0)
    written = []

    def put(rel, obj):
        save_json(obj, O / rel)
        written.append(rel)

    kpis = [
        {"id": "total_returns", "label": "Returns", "value": int(n), "unit": "count"},
        {"id": "profit_lost", "label": "Profit lost to returns", "value": round(float(loss.sum()), 2), "unit": "currency"},
        {"id": "avg_loss", "label": "Average profit lost per return", "value": round(float(loss.mean()), 4) if n else 0, "unit": "currency"},
        {"id": "returned_value", "label": "Returned order value", "value": round(float(value.sum()), 2), "unit": "currency"},
        {"id": "loss_to_value", "label": "Profit lost as share of returned value", "value": _pct(loss.sum(), value.sum()), "unit": "ratio"},
        {"id": "abuse_count", "label": "Suspected abuse returns", "value": int(flag.sum()), "unit": "count"},
        {"id": "abuse_rate", "label": "Suspected abuse rate", "value": _pct(flag.sum(), n), "unit": "ratio"},
    ]
    if "return_cost" in df.columns:
        kpis.append({"id": "cost_to_value", "label": "Return handling cost as share of returned value",
                     "value": _pct(df["return_cost"].sum(), value.sum()), "unit": "ratio"})
    if "priority" in df.columns:
        kpis.append({"id": "p1_count", "label": "Urgent returns", "value": int((df["priority"] == "P1_URGENT").sum()), "unit": "count"})
    put("understand/kpis.json", {"kpis": kpis})

    if "segment" in df.columns:
        seg = df.groupby("segment").agg(returns=("row_id", "count"), profit_lost=(N["profit_lost"], "sum"),
                                       abuse_rate=(N["abuse_flag"], "mean")).reset_index()
        put("understand/segments.json", {"segments": json.loads(seg.round(4).to_json(orient="records")),
                                         "meta": read_json(P.FILES["segment_meta"], {})})
    else:
        put("understand/segments.json", {"status": "skipped", "reason": "segmentation did not run"})
    if "is_anomaly" in df.columns:
        an = df[df["is_anomaly"] == 1].sort_values(N["profit_lost"], ascending=False).head(EXPORT_ROW_CAP)
        rows = [{"return": _hash_id(r[N["return_id"]]), "category": r[N["category"]], "profit_lost": round(float(r[N["profit_lost"]]), 2)}
                for _, r in an.iterrows()]
        by_cat = df.groupby(N["category"])["is_anomaly"].mean().round(4)
        put("understand/anomalies.json", {"count": int(df["is_anomaly"].sum()), "rate": _pct(df["is_anomaly"].sum(), n),
                                           "by_category": by_cat.to_dict(), "rows": rows})
    else:
        put("understand/anomalies.json", {"status": "skipped", "reason": "anomaly detection did not run"})

    specs = {p.stem: read_json(p, None) for p in sorted(P.SPECS_DIR.glob("*.json"))}
    specs = {k: v for k, v in specs.items() if v and "data" in v}
    if "priority" in df.columns:
        pc = df["priority"].value_counts().sort_index()
        specs["priority_breakdown"] = _spec("priority_breakdown", "Returns by priority", "bar", "Priority", "Returns",
                                            [{"label": k, "value": int(v)} for k, v in pc.items()], "decide")
    if "segment" in df.columns:
        sc = df["segment"].value_counts()
        specs["segment_sizes"] = _spec("segment_sizes", "Segment sizes", "bar", "Segment", "Returns",
                                       [{"label": k, "value": int(v)} for k, v in sc.items()], "understand")
    if "is_anomaly" in df.columns:
        ar = df.groupby(N["category"])["is_anomaly"].mean()
        specs["anomaly_rate_by_group"] = _spec("anomaly_rate_by_group", "Unusual return rate by category", "bar", "Category",
                                               "Rate", [{"label": str(k), "value": round(float(v), 4)} for k, v in ar.items()], "understand")
    met = read_json(P.FILES["metrics"], {}) or {}
    if met.get("importances"):
        specs["top_feature_importance"] = _spec("top_feature_importance", "Top predictors of suspected abuse", "bar", "Feature",
                                                "Importance", [{"label": d["feature"], "value": d["importance"]} for d in met["importances"][:10]], "understand")
    index = []
    for cid, sp in specs.items():
        put("understand/charts/" + cid + ".json", sp)
        index.append({"id": cid, "title": sp["title"], "type": sp["type"], "outcome": sp.get("outcome", ""),
                      "file": "understand/charts/" + cid + ".json"})
    put("understand/charts.json", {"charts": index})

    ins = read_json(P.FILES["insights"], [])
    put("decide/insights.json", {"insights": ins if isinstance(ins, list) else []})
    if "recommendations" in df.columns:
        top = df[df["priority"].isin(["P1_URGENT", "P2_HIGH"])].sort_values(N["profit_lost"], ascending=False).head(EXPORT_ROW_CAP)
        rows = [{"return": _hash_id(r[N["return_id"]]), "priority": r["priority"], "alerts": r["alerts"],
                 "recommendations": r["recommendations"], "profit_lost": round(float(r[N["profit_lost"]]), 2)} for _, r in top.iterrows()]
        alert_counts = df["alerts"].str.split("|").explode().value_counts().to_dict()
        put("decide/recommendations.json", {"summary": alert_counts, "rows": rows})
    else:
        put("decide/recommendations.json", {"status": "skipped", "reason": "business rules did not run"})
    sims = []
    for name in scenarios_mod.SCENARIO_FILES:
        src = P.SIM_DIR / (name + ".json")
        if src.exists():
            sims.append("decide/simulations/" + name + ".json")
            written.append(sims[-1])
    goals = goals_mod.load_goals()
    put("decide/goals.json", goals)
    put("monitor/goal_progress.json", goals_mod.progress(df, N, goals))

    fm = read_json(P.FILES["forecast_metrics"], None)
    if fm and P.FILES["forecast"].exists():
        put("monitor/forecast.json", {"metrics": fm, "series": json.loads(pd.read_csv(P.FILES["forecast"]).to_json(orient="records"))})
    else:
        put("monitor/forecast.json", {"status": "skipped", "reason": "forecast did not run"})
    wk = goals_mod.progress(df, N, goals).get("weekly_alert")
    put("monitor/alerts.json", {"weekly_alert": wk, "priority_counts": df["priority"].value_counts().to_dict() if "priority" in df.columns else {},
                                 "alert_counts": df["alerts"].str.split("|").explode().value_counts().to_dict() if "alerts" in df.columns else {}})

    put("meta/summary.json", {"project": PROJECT_TITLE, "rows": int(n), "profit_lost": round(float(loss.sum()), 2),
                              "abuse_rate": _pct(flag.sum(), n), "source": source})
    put("meta/terminology.json", TERMINOLOGY)
    put("meta/model_meta.json", {"model_name": "primary_model", "algorithm": met.get("best_model", ""),
                                 "feature_count": len(met.get("feature_cols", [])), "feature_cols": met.get("feature_cols", []),
                                 "models_ready": bool(P.FILES["model_file"].exists())})
    history = read_json(P.FILES["run_record"], [])
    update_run_log({"history": history[-10:] if isinstance(history, list) else []})
    written.append("meta/run_log.json")

    num_cols = (read_json(P.FILES["feature_list"], {}) or {}).get("numeric", [])
    contract = {
        "generated_at": pd.Timestamp.now().replace(microsecond=0).isoformat(),
        "project": {"name": PROJECT_TITLE, "domain": DOMAIN, "client_id": CLIENT_ID, "description": DESCRIPTION},
        "terminology": TERMINOLOGY,
        "source": {"type": "bigquery", **{k: BIGQUERY[k] for k in ("project_id", "dataset", "table", "credentials_file")}}
        if source == "bigquery" else {"type": "csv", "file": "data/processed/feature_store.csv"},
        "outcomes": {
            "understand": {"kpis": "understand/kpis.json", "charts": "understand/charts.json",
                           "segments": "understand/segments.json", "anomalies": "understand/anomalies.json"},
            "decide": {"insights": "decide/insights.json", "recommendations": "decide/recommendations.json",
                       "simulations": sims, "goals": "decide/goals.json"},
            "monitor": {"forecast": "monitor/forecast.json", "goal_progress": "monitor/goal_progress.json",
                        "alerts": "monitor/alerts.json"},
        },
        "model": {"type": "classification", "pkl_file": "", "feature_cols_file": "meta/model_meta.json",
                  "input_fields": num_cols, "output_label": "suspected abuse", "horizon": "per return"},
        "forecaster": {"input_schema": [{"name": c, "type": "float", "range": []} for c in num_cols],
                       "output_schema": {"prediction": "int", "probability": "float", "risk_level": "str"}},
        "frontend": {"framework": "vanilla HTML/JS", "deploy_target": "cloudflare_pages"},
        "files": [],
    }
    for rel in written + ["frontend_contract.json"]:
        p = O / rel
        if rel != "frontend_contract.json" and (not p.exists() or p.stat().st_size == 0):
            save_json({"status": "skipped", "reason": "file not produced"}, p)
        contract["files"].append({"filename": rel, "purpose": rel.split("/")[0], "schema": {}})
    save_json(contract, P.FILES["contract"])
    total_kb = sum(f.stat().st_size for f in O.rglob("*") if f.is_file()) / 1024
    if verbose:
        print("Source:", source)
        print("Contract:", P.FILES["contract"].name, " files:", len(contract["files"]), " total KB:", round(total_kb, 1))
    return contract
