import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.analysis import profiling as explore
from src.analytics import targets as goals
from src.analytics import insights as insights
from src.analytics import alerts as rules
from src.analytics import what_if as scenarios
from src.data import ingest as intake
from src.data import clean as cleaning
from src.features import build as features
from src.models import classifier as classifier
from src.models import clusters as segments
from src.models import forecasting as forecast
from src.reporting import excel_export as workbook
from src.reporting import dashboard
from src.utils import paths as P
from src.utils.runner import run_stage, save_run_record, verify_outputs

F = P.FILES


def main():
    P.ensure_dirs()
    run_stage("Data intake and checks", intake.run, produces=(F["validation"],))
    run_stage("Data cleaning", cleaning.run, requires=(F["validation"],), produces=(F["clean"], F["cleaning_log"]))
    run_stage("Feature building", features.run, requires=(F["clean"],), produces=(F["features"],))
    run_stage("Exploratory charts", explore.run, requires=(F["features"],))
    run_stage("Goals", goals.run)
    run_stage("Abuse model", classifier.run, requires=(F["features"],), produces=(F["metrics"],))
    run_stage("Customer segments and unusual returns", segments.run, requires=(F["features"],), produces=(F["segment_meta"],))
    run_stage("Weekly forecast", forecast.run, requires=(F["features"],), produces=(F["forecast_metrics"],))
    run_stage("Alerts and actions", rules.run, requires=(F["features"],), produces=(F["actions"],))
    run_stage("Scenarios", scenarios.run, requires=(F["features"],))
    run_stage("Insights", insights.run, requires=(F["features"],), produces=(F["insights"],))
    run_stage("Excel workbook", workbook.run, requires=(F["features"],), produces=(F["workbook"],))
    run_stage("Interactive dashboard page", dashboard.run, requires=(F["features"],), produces=(F["dashboard_html"],))
    save_run_record()
    verify_outputs({"clean data": F["clean"], "features": F["features"], "insights": F["insights"],
                    "model metrics": F["metrics"], "actions": F["actions"], "workbook": F["workbook"]})


if __name__ == "__main__":
    main()
