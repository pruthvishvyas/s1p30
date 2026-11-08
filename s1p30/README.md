# s1p30

Cost, abuse and recovery analysis of ecommerce product returns.

## Business Problem

Returns cost money twice: the sale profit is reversed and the return itself has to be shipped, handled and re-sold. The project shows where the loss sits, which returns look abusive and what to do about them this week.

## The Core Finding

Across 1,000 returns, $71,474 of profit was lost, and 19.2% of returns carry the suspected abuse flag.

## Dataset

Rows after cleaning: 1,000 (raw rows: 1,000).

## Project Structure

```
.gitignore
backend/
  export_for_frontend.py
  main.py
  requirements.txt
  config/
    __init__.py
    goals.json
    settings.py
  data/
    interim/
    processed/
    raw/
  logs/
    run_record.json
  models/
    anomaly_model.joblib
    feature_list.json
    forecast_metrics.json
    forecast_model.joblib
    leakage_log.json
    model_hashes.json
    model_metrics.json
    primary_model.joblib
    segment_meta.json
    segment_model.joblib
  output/
    frontend_contract.json
    decide/
      simulations/
    meta/
    monitor/
    understand/
      charts/
  reports/
    abuse_rate_by_reason.png
    abuse_rate_category_by_type.png
    correlation_heatmap.png
    days_to_return_by_flag.png
    feature_importance.png
    flag_distribution.png
    insights.json
    interactive_dashboard.html
    model_evaluation.png
    price_vs_loss_scatter.png
    priority_distribution.png
    profit_lost_by_category.png
    chart_specs/
  src/
    __init__.py
    analysis/
    analytics/
    data/
    features/
    models/
    reporting/
    serving/
    utils/
```

## How It Works

The data is read and checked, cleaned, and turned into return cost, recovery and timing features. A classifier scores suspected abuse, returns are grouped into risk segments, unusual returns are isolated, weekly profit loss is forecast, business rules attach actions to each return, and everything is packaged for the dashboard.

## Models

| Model | Status |
| --- | --- |
| Abuse classifier | Ready |
| Segments | Ready |
| Weekly forecast | Ready |

## Key Insights

- Returns erase profit on a large share of returned orders. $71,474 of profit lost across 1,000 returns; 1,000 returns (100.0%) end below zero profit.
- Fashion is the category with the largest profit lost. $26,508 lost, 37.1% of the total of $71,474.
- A visible group of returns is flagged as suspected abuse. 192 of 1,000 returns (19.2%) carry the flag and account for $16,241 (22.7% of profit lost).

## How to Run

1. Open the backend folder.
2. Install packages with pip install -r requirements.txt.
3. Run python main.py, or run the notebook from top to bottom.
4. Run python export_for_frontend.py to write the dashboard data.
5. Open reports/interactive_dashboard.html or the Excel workbook in reports/.
6. Start the dashboard from the frontend folder as described in its own notes.

## Output Files

| File | Purpose |
| --- | --- |
| data/processed/clean_data.csv | cleaned returns |
| data/processed/feature_store.csv | features for every return |
| data/processed/business_actions.csv | alerts, priority and actions |
| reports/insights.json | findings and actions |
| reports/returns_report.xlsx | workbook |
| output/ | dashboard data |

## Tech Stack

Python, pandas, scikit-learn, matplotlib, plotly, openpyxl, joblib.
