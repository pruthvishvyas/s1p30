import datetime
import time
import traceback
from pathlib import Path

from src.utils import paths as P
from src.utils.io_utils import read_json, save_json


class StageSkip(Exception):
    pass


DataSizeSkip = StageSkip
RUN = []


def _now():
    return datetime.datetime.now().replace(microsecond=0).isoformat()


def _stand_in(produces, status, reason):
    for p in produces:
        p = Path(p)
        if p.suffix == ".json":
            try:
                save_json({"status": status, "reason": reason}, p)
            except Exception:
                pass


def run_stage(name, fn, requires=(), produces=()):
    started = time.time()
    status, reason = "OK", ""
    missing = [Path(r).name for r in requires if not Path(r).exists()]
    if missing:
        status, reason = "SKIPPED", "missing input: " + ", ".join(missing)
    else:
        try:
            fn()
        except StageSkip as exc:
            status, reason = "SKIPPED", str(exc)
        except Exception as exc:
            status, reason = "FAILED", str(exc).splitlines()[0] if str(exc) else type(exc).__name__
            try:
                P.LOGS_DIR.mkdir(parents=True, exist_ok=True)
                with open(P.FILES["errors_log"], "a", encoding="utf-8") as fh:
                    fh.write("[" + _now() + "] " + name + "\n" + traceback.format_exc() + "\n")
            except OSError:
                pass
    if status == "OK":
        bad = [Path(p).name for p in produces if not Path(p).exists() or Path(p).stat().st_size == 0]
        if bad:
            status, reason = "FAILED", "no output written: " + ", ".join(bad)
    if status != "OK":
        _stand_in(produces, status.lower(), reason)
    rec = {"stage": name, "status": status, "seconds": round(time.time() - started, 2), "reason": reason,
           "outputs": [Path(p).name for p in produces]}
    RUN.append(rec)
    print("[" + status + "] " + name + ((" - " + reason) if reason else ""))
    return status


def save_run_record():
    hist = read_json(P.FILES["run_record"], [])
    if not isinstance(hist, list):
        hist = []
    hist.append({"finished_at": _now(), "stages": list(RUN)})
    save_json(hist[-20:], P.FILES["run_record"])


def update_run_log(patch):
    cur = read_json(P.FILES["run_log"], {})
    if not isinstance(cur, dict):
        cur = {}
    cur.update(patch)
    cur["updated_at"] = _now()
    save_json(cur, P.FILES["run_log"])


def verify_outputs(expected, label="pipeline"):
    rows, ok_all = [], True
    for key, path in expected.items():
        p = Path(path)
        ok = p.exists() and p.stat().st_size > 0
        if ok and p.suffix == ".json":
            ok = read_json(p, None) is not None
        ok_all = ok_all and ok
        rows.append({"output": key, "file": p.name, "ok": bool(ok)})
    print("Output check (" + label + ")")
    for r in rows:
        print("  " + ("ok     " if r["ok"] else "MISSING") + "  " + r["output"] + "  " + r["file"])
    update_run_log({"checks_" + label: rows, "stages": list(RUN)})
    return ok_all
