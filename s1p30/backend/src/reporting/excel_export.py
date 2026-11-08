import datetime

import pandas as pd
from openpyxl import Workbook

from config.settings import PROJECT_TITLE
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, read_json

MAX_ROWS = 1000000


def _safe(v):
    if isinstance(v, str) and v[:1] in ("=", "+", "-", "@"):
        return "'" + v
    return v


def _scrub_app_properties(path):
    import os
    import zipfile
    tmp = str(path) + ".tmp"
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "docProps/app.xml":
                data = data.decode("utf-8").replace("Microsoft Excel Compatible / Openpyxl 3.1.5", "Microsoft Excel").encode("utf-8")
            zout.writestr(item, data)
    os.replace(tmp, path)


def _sheet(wb, title, frame, note=None):
    ws = wb.create_sheet(title=title[:31])
    if frame is None or len(frame) == 0:
        ws.append(["Not available" + ((": " + note) if note else "")])
        return
    ws.append([str(c) for c in frame.columns])
    for row in frame.itertuples(index=False):
        ws.append([_safe(v.item() if hasattr(v, "item") else v) for v in row])
    for i, c in enumerate(frame.columns, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = min(40, max(12, len(str(c)) + 2))


def run(verbose=True):
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    for key in ("predictions", "segments", "actions"):
        if P.FILES[key].exists():
            extra = pd.read_csv(P.FILES[key])
            df = df.merge(extra[[c for c in extra.columns if c not in df.columns or c == "row_id"]], on="row_id", how="left")
    loss = pd.to_numeric(df[N["profit_lost"]], errors="coerce").fillna(0)
    flag = pd.to_numeric(df[N["abuse_flag"]], errors="coerce").fillna(0).clip(0, 1)
    wb = Workbook()
    wb.remove(wb.active)
    kpi = pd.DataFrame({"Measure": ["Returns", "Profit lost", "Average profit lost per return", "Suspected abuse returns",
                                    "Suspected abuse rate"],
                        "Value": [len(df), round(float(loss.sum()), 2), round(float(loss.mean()), 2), int(flag.sum()),
                                  round(float(flag.mean()), 4)]})
    _sheet(wb, "Returns Summary", kpi)
    if "priority" in df.columns:
        pr = df.groupby("priority").agg(Returns=("row_id", "count"), ProfitLost=(N["profit_lost"], "sum")).reset_index()
        _sheet(wb, "Priority Analysis", pr.round(2))
    else:
        _sheet(wb, "Priority Analysis", None, "business rules stage did not run")
    if "segment" in df.columns:
        sg = df.groupby("segment").agg(Returns=("row_id", "count"), ProfitLost=(N["profit_lost"], "sum"),
                                       AbuseRate=(N["abuse_flag"], "mean")).reset_index()
        _sheet(wb, "Segment Summary", sg.round(3))
    else:
        _sheet(wb, "Segment Summary", None, "segmentation stage did not run")
    dom = df.groupby([N["category"], N["reason"]]).agg(Returns=("row_id", "count"), ProfitLost=(N["profit_lost"], "sum")).reset_index()
    _sheet(wb, "Category and Reason", dom.sort_values("ProfitLost", ascending=False).round(2))
    if P.FILES["forecast"].exists():
        _sheet(wb, "Weekly Forecast", pd.read_csv(P.FILES["forecast"]))
    else:
        _sheet(wb, "Weekly Forecast", None, "forecast stage did not run")
    full = df.head(MAX_ROWS - 1)
    _sheet(wb, "All Records", full)
    wb.properties.creator = ""
    wb.properties.lastModifiedBy = ""
    wb.properties.title = PROJECT_TITLE
    target = P.FILES["workbook"]
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        wb.save(target)
    except PermissionError:
        target = target.with_name(target.stem + "_" + datetime.datetime.now().strftime("%H%M%S") + ".xlsx")
        wb.save(target)
    _scrub_app_properties(target)
    if verbose:
        print("=" * 60)
        print("Returns analyzed:", len(df))
        print("Profit lost:", round(float(loss.sum()), 2), " suspected abuse rate:", round(float(flag.mean()), 4))
        if "is_anomaly" in df.columns:
            print("Unusual returns:", int(df["is_anomaly"].fillna(0).sum()))
        if "priority" in df.columns:
            print("P1 urgent:", int((df["priority"] == "P1_URGENT").sum()))
        print("=" * 60)
    return target
