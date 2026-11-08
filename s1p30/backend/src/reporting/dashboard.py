import pandas as pd

from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, write_text


def run(verbose=True):
    import plotly.graph_objects as go
    import plotly.io as pio
    from plotly.subplots import make_subplots
    pio.templates.default = None
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    if P.FILES["actions"].exists():
        df = df.merge(pd.read_csv(P.FILES["actions"])[["row_id", "priority"]], on="row_id", how="left")
    flag = pd.to_numeric(df[N["abuse_flag"]], errors="coerce").fillna(0).clip(0, 1)
    by_cat = flag.groupby(df[N["category"]]).mean()
    fig = make_subplots(rows=2, cols=2, subplot_titles=("Abuse rate by category", "Risk score", "Price against profit lost",
                                                        "Returns by priority"))
    fig.add_trace(go.Bar(x=list(by_cat.index), y=list(by_cat.values)), row=1, col=1)
    if "return_risk_score" in df.columns:
        fig.add_trace(go.Histogram(x=df["return_risk_score"]), row=1, col=2)
    fig.add_trace(go.Scatter(x=df[N["unit_price"]], y=df[N["profit_lost"]], mode="markers",
                             marker={"color": flag, "size": 5}), row=2, col=1)
    if "priority" in df.columns:
        pc = df["priority"].value_counts().sort_index()
        fig.add_trace(go.Bar(x=list(pc.index), y=list(pc.values)), row=2, col=2)
    fig.update_layout(showlegend=False, height=800, title_text="Returns dashboard")
    html = fig.to_html(include_plotlyjs="cdn", full_html=True)
    write_text(html.replace("<title></title>", "<title>Returns dashboard</title>"), P.FILES["dashboard_html"])
    if verbose:
        print("Dashboard page written:", P.FILES["dashboard_html"].name)
