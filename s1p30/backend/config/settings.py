from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

PROJECT_SLUG = "s1p30"
PROJECT_TITLE = "s1p30"
DOMAIN = "retail returns"
CLIENT_ID = "s1p30"
DESCRIPTION = "Cost, abuse and recovery analysis of ecommerce product returns"
CURRENCY = "$"
ID_SALT = "s1p30-ids"

RANDOM_STATE = 42
TEST_SIZE = 0.25
# roughly one return in twenty is expected to look structurally odd (very costly, very slow, very large)
ANOMALY_CONTAMINATION = 0.05
# row level exports to the dashboard are capped so the feed stays small and low risk
EXPORT_ROW_CAP = 200

# logical name -> (exact header in the client file, required)
COLUMNS = {
    "return_id": ("Return_ID", True),
    "order_id": ("Order_ID", False),
    "order_date": ("Order_Date", True),
    "return_date": ("Return_Date", True),
    "month": ("Month", False),
    "days_to_return": ("Days_to_Return", False),
    "customer_id": ("Customer_ID", True),
    "customer_type": ("Customer_Type", False),
    "country": ("Country", False),
    "category": ("Category", True),
    "product": ("Product", False),
    "quantity": ("Quantity", False),
    "unit_price": ("Unit_Price", False),
    "discount_pct": ("Discount_pct", False),
    "order_value": ("Returned_Order_Value", True),
    "reason": ("Return_Reason", True),
    "method": ("Return_Method", False),
    "label_fee": ("Return_Label_Fee_Charged", False),
    "reverse_ship": ("Reverse_Shipping_Cost", False),
    "condition": ("Item_Condition", False),
    "disposition": ("Disposition", False),
    "processing_days": ("Processing_Days", False),
    "handling_cost": ("Warehouse_Handling_Cost", False),
    "refund_type": ("Refund_Type", False),
    "refund_amount": ("Refund_Amount", False),
    "unit_cost": ("Unit_Cost", False),
    "recovery_value": ("Item_Recovery_Value_at_Cost", False),
    "vendor_credit": ("Vendor_Credit", False),
    "exchange_cost": ("Exchange_Replacement_Cost", False),
    "sale_profit": ("Original_Sale_Profit", False),
    "profit_after": ("Profit_After_Return", False),
    "profit_lost": ("Profit_Lost_to_Return", True),
    "customer_returns": ("Customer_Return_Count_Dataset", False),
    "abuse_flag": ("Suspected_Abuse_Flag", True),
}

NUMERIC_KEYS = ["days_to_return", "quantity", "unit_price", "discount_pct", "order_value", "label_fee",
                "reverse_ship", "processing_days", "handling_cost", "refund_amount", "unit_cost",
                "recovery_value", "vendor_credit", "exchange_cost", "sale_profit", "profit_after",
                "profit_lost", "customer_returns", "abuse_flag"]
CATEGORY_KEYS = ["customer_type", "country", "category", "product", "reason", "method", "condition",
                 "disposition", "refund_type"]
DATE_KEYS = ["order_date", "return_date"]

PII_TOKENS = ["email", "phone", "name", "address", "ssn", "dob", "ip"]

TERMINOLOGY = {
    "revenue": "Order value",
    "customer": "Customer",
    "product": "Product",
    "transaction": "Return",
}

# columns known only after the return is received or settled are left out of the abuse model
MODEL_NUMERIC_KEYS = ["quantity", "unit_price", "discount_pct", "order_value", "days_to_return", "customer_returns"]
MODEL_CATEGORY_KEYS = ["customer_type", "country", "category", "reason", "method", "condition"]
MODEL_ENGINEERED_NUMERIC = ["high_value_flag", "fast_return_flag", "opened_or_used_flag", "weekend_return_flag"]
MODEL_ENGINEERED_CATEGORY = ["discount_band", "price_tier"]

THRESHOLDS = {
    "repeat_returner_min": 3,       # three or more returns on one account is the usual review line
    "fast_return_days": 3,          # returned within three days of the return window opening looks like wardrobing or bracketing
    "cost_ratio_alert": 0.25,       # handling plus shipping above a quarter of order value eats most of the margin
    "low_recovery_rate": 0.2,       # recovering under 20% of cost means the item is effectively scrapped
    "model_risk_prob": 0.7,         # review queue size stays manageable at this score
    "high_value_quantile": 0.75,
    "deep_discount_pct": 20,
}

CHARTS = {
    "flag_distribution": "flag_distribution.png",
    "loss_by_reason": "profit_lost_by_reason.png",
    "loss_by_category": "profit_lost_by_category.png",
    "days_by_flag": "days_to_return_by_flag.png",
    "correlations": "correlation_heatmap.png",
    "abuse_by_reason": "abuse_rate_by_reason.png",
    "score_by_flag": "risk_score_by_flag.png",
    "price_vs_loss": "price_vs_loss_scatter.png",
    "abuse_heatmap": "abuse_rate_category_by_type.png",
    "weekly_trend": "weekly_profit_lost.png",
    "model_eval": "model_evaluation.png",
    "importance": "feature_importance.png",
    "segments": "segments_and_anomalies.png",
    "forecast": "weekly_forecast.png",
    "priority": "priority_distribution.png",
}

BIGQUERY = {"project_id": "", "dataset": "", "table": "feat", "credentials_file": "credentials.json"}
