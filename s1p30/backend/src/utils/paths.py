from config.settings import PROJECT_ROOT as ROOT

RAW_DIR = ROOT / "data" / "raw"
INTERIM_DIR = ROOT / "data" / "interim"
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"
SPECS_DIR = REPORTS_DIR / "chart_specs"
OUTPUT_DIR = ROOT / "output"
SIM_DIR = OUTPUT_DIR / "decide" / "simulations"
LOGS_DIR = ROOT / "logs"
GOALS_FILE = ROOT / "config" / "goals.json"

FILES = {
    "validation": INTERIM_DIR / "validation_report.json",
    "cleaning_log": INTERIM_DIR / "cleaning_log.json",
    "feature_log": INTERIM_DIR / "feature_log.json",
    "clean": PROCESSED_DIR / "clean_data.csv",
    "features": PROCESSED_DIR / "feature_store.csv",
    "predictions": PROCESSED_DIR / "model_predictions.csv",
    "segments": PROCESSED_DIR / "segments_anomalies.csv",
    "forecast": PROCESSED_DIR / "forecast_output.csv",
    "actions": PROCESSED_DIR / "business_actions.csv",
    "insights": REPORTS_DIR / "insights.json",
    "workbook": REPORTS_DIR / "returns_report.xlsx",
    "dashboard_html": REPORTS_DIR / "interactive_dashboard.html",
    "model_file": MODELS_DIR / "primary_model.joblib",
    "feature_list": MODELS_DIR / "feature_list.json",
    "metrics": MODELS_DIR / "model_metrics.json",
    "leakage": MODELS_DIR / "leakage_log.json",
    "segment_model": MODELS_DIR / "segment_model.joblib",
    "anomaly_model": MODELS_DIR / "anomaly_model.joblib",
    "segment_meta": MODELS_DIR / "segment_meta.json",
    "forecast_model": MODELS_DIR / "forecast_model.joblib",
    "forecast_metrics": MODELS_DIR / "forecast_metrics.json",
    "run_record": LOGS_DIR / "run_record.json",
    "errors_log": LOGS_DIR / "errors.log",
    "run_log": OUTPUT_DIR / "meta" / "run_log.json",
    "contract": OUTPUT_DIR / "frontend_contract.json",
}


def ensure_dirs():
    for d in (RAW_DIR, INTERIM_DIR, PROCESSED_DIR, MODELS_DIR, REPORTS_DIR, SPECS_DIR, OUTPUT_DIR, SIM_DIR, LOGS_DIR,
              OUTPUT_DIR / "understand" / "charts", OUTPUT_DIR / "decide", OUTPUT_DIR / "monitor", OUTPUT_DIR / "meta"):
        d.mkdir(parents=True, exist_ok=True)


def raw_input_file():
    found = sorted(p for p in RAW_DIR.glob("*") if p.suffix.lower() in (".csv", ".xlsx", ".xls"))
    if not found:
        raise FileNotFoundError("No data file found in " + str(RAW_DIR))
    return found[0]
