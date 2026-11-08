import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.serving import feed as feed
from src.utils import paths as P
from src.utils.runner import run_stage, verify_outputs

if __name__ == "__main__":
    P.ensure_dirs()
    run_stage("Dashboard data", feed.export_all, requires=(P.FILES["features"],), produces=(P.FILES["contract"],))
    verify_outputs({"contract": P.FILES["contract"], "kpis": P.OUTPUT_DIR / "understand" / "kpis.json",
                    "charts": P.OUTPUT_DIR / "understand" / "charts.json",
                    "insights": P.OUTPUT_DIR / "decide" / "insights.json"}, label="dashboard_data")
