import difflib
import re

from config.settings import COLUMNS


class ColumnError(Exception):
    pass


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def resolve_columns(df, spec=None, quiet=True):
    spec = spec or COLUMNS
    actual = list(df.columns)
    by_norm = {_norm(c): c for c in actual}
    found, missing = {}, []
    for key, (name, required) in spec.items():
        if name in actual:
            found[key] = name
        elif _norm(name) in by_norm:
            found[key] = by_norm[_norm(name)]
        else:
            close = difflib.get_close_matches(_norm(name), list(by_norm), n=1, cutoff=0.85)
            if close:
                found[key] = by_norm[close[0]]
                if not quiet:
                    print("Column", name, "matched to", found[key])
            elif required:
                missing.append((name, difflib.get_close_matches(name, actual, n=3, cutoff=0.4)))
    if missing:
        lines = ["Missing required column(s):"]
        for name, cands in missing:
            lines.append("  " + name + "  (closest: " + (", ".join(cands) or "none") + ")")
        lines.append("Headers found: " + ", ".join(actual))
        raise ColumnError("\n".join(lines))
    return found
