import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score, roc_curve)
from sklearn.model_selection import (GroupShuffleSplit, StratifiedGroupKFold, StratifiedKFold,
                                     cross_val_score, train_test_split)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from config.settings import (CHARTS, MODEL_CATEGORY_KEYS, MODEL_ENGINEERED_CATEGORY, MODEL_ENGINEERED_NUMERIC,
                             MODEL_NUMERIC_KEYS, RANDOM_STATE, TEST_SIZE, THRESHOLDS)
from src.utils import paths as P
from src.utils.columns import resolve_columns
from src.utils.io_utils import load_required, save_fig, save_json, save_model
from src.utils.runner import DataSizeSkip

try:
    from xgboost import XGBClassifier
except Exception:
    XGBClassifier = None


def feature_lists(df, N):
    num = [N[k] for k in MODEL_NUMERIC_KEYS if k in N] + [c for c in MODEL_ENGINEERED_NUMERIC if c in df.columns]
    cat = [N[k] for k in MODEL_CATEGORY_KEYS if k in N] + [c for c in MODEL_ENGINEERED_CATEGORY if c in df.columns]
    return num, cat


def leakage_guard(df, num, y):
    # a lone feature that almost perfectly separates the target is a copy of the answer, not a signal
    kept, dropped = [], []
    for c in num:
        x = pd.to_numeric(df[c], errors="coerce")
        x = x.fillna(x.median())
        if x.nunique() < 2:
            kept.append(c)
            continue
        auc = roc_auc_score(y, x)
        auc = max(auc, 1 - auc)
        corr = abs(np.corrcoef(x, y)[0, 1])
        if auc > 0.97 or corr > 0.95:
            dropped.append({"feature": c, "single_feature_auc": round(float(auc), 4), "abs_corr": round(float(corr), 4),
                            "reason": "almost identical to the target"})
        else:
            kept.append(c)
    return kept, dropped


def make_pipe(est, num, cat):
    pre = ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")),
                          ("oh", OneHotEncoder(handle_unknown="ignore"))]), cat),
    ])
    return Pipeline([("pre", pre), ("model", est)])


def run(verbose=True):
    df = load_required(P.FILES["features"], "feature")
    N = resolve_columns(df)
    y = pd.to_numeric(df[N["abuse_flag"]], errors="coerce").fillna(0).astype(int)
    if y.nunique() != 2:
        raise DataSizeSkip("target is not binary, classification skipped")
    num, cat = feature_lists(df, N)
    num, dropped = leakage_guard(df, num, y)
    for d in dropped:
        print("Dropped feature", d["feature"], "(", d["reason"], ")") if verbose else None
    save_json({"dropped": dropped}, P.FILES["leakage"])
    cols = num + cat
    X = df[cols]

    groups = df[N["customer_id"]] if "customer_id" in N else None
    use_groups = groups is not None and groups.duplicated().any()
    tr = te = None
    if use_groups:
        for seed in range(RANDOM_STATE, RANDOM_STATE + 25):
            tr, te = next(GroupShuffleSplit(n_splits=1, test_size=TEST_SIZE, random_state=seed).split(X, y, groups))
            if y.iloc[tr].nunique() == 2 and y.iloc[te].nunique() == 2:
                break
        else:
            use_groups = False
    if not use_groups:
        tr, te = train_test_split(np.arange(len(df)), test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE)
    Xtr, Xte, ytr, yte = X.iloc[tr], X.iloc[te], y.iloc[tr], y.iloc[te]
    if len(Xtr) < 20:
        raise DataSizeSkip("fewer than 20 training rows, classification skipped")
    minority = int(ytr.value_counts().min())
    low_sample = len(df) < 100 or minority < 10
    folds = max(2, min(5, minority))
    if use_groups:
        cv = StratifiedGroupKFold(n_splits=folds, shuffle=True, random_state=RANDOM_STATE)
        cv_args = {"groups": groups.iloc[tr]}
    else:
        cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=RANDOM_STATE)
        cv_args = {}

    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, class_weight="balanced"),
        "Random Forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=3, class_weight="balanced_subsample",
                                                random_state=RANDOM_STATE, n_jobs=-1),
        "Gradient Boosting": GradientBoostingClassifier(random_state=RANDOM_STATE),
    }
    if XGBClassifier is not None:
        models["XGBoost"] = XGBClassifier(n_estimators=200, max_depth=3, learning_rate=0.08, eval_metric="logloss",
                                          random_state=RANDOM_STATE, verbosity=0)

    majority_acc = float(max(yte.mean(), 1 - yte.mean()))
    rule_acc = None
    if "repeat_returner_flag" in df.columns:
        rule_acc = float(accuracy_score(yte, df["repeat_returner_flag"].iloc[te]))
    if verbose:
        print("Majority class accuracy on test:", round(majority_acc, 4))
        if rule_acc is not None:
            print("Rule baseline (repeat returner) accuracy on test:", round(rule_acc, 4))

    results, fitted = {}, {}
    for name, est in models.items():
        pipe = make_pipe(est, num, cat)
        scores = cross_val_score(pipe, Xtr, ytr, cv=cv, scoring="roc_auc", **cv_args)
        pipe.fit(Xtr, ytr)
        prob = pipe.predict_proba(Xte)[:, 1]
        results[name] = {"cv_auc_mean": float(scores.mean()), "cv_auc_std": float(scores.std()),
                         "test_auc": float(roc_auc_score(yte, prob)),
                         "test_acc": float(accuracy_score(yte, (prob >= 0.5).astype(int)))}
        fitted[name] = pipe
        if verbose:
            r = results[name]
            print(f"{name}: CV-AUC {r['cv_auc_mean']:.3f} +/- {r['cv_auc_std']:.3f} (training folds), "
                  f"Test-AUC {r['test_auc']:.3f}, Test-Acc {r['test_acc']:.3f}")
    best = max(results, key=lambda k: results[k]["cv_auc_mean"])
    pipe = fitted[best]
    prob_te = pipe.predict_proba(Xte)[:, 1]
    pred_te = (prob_te >= 0.5).astype(int)
    if verbose:
        print("Selected model (best cross-validation):", best)
        print(classification_report(yte, pred_te, zero_division=0))

    test = {"auc": float(roc_auc_score(yte, prob_te)), "accuracy": float(accuracy_score(yte, pred_te)),
            "precision": float(precision_score(yte, pred_te, zero_division=0)),
            "recall": float(recall_score(yte, pred_te, zero_division=0)),
            "f1": float(f1_score(yte, pred_te, zero_division=0))}
    beats = test["auc"] >= 0.55
    imp = permutation_importance(pipe, Xte, yte, n_repeats=5, random_state=RANDOM_STATE, scoring="roc_auc")
    order = np.argsort(imp.importances_mean)[::-1][:15]
    importances = [{"feature": cols[i], "importance": round(float(imp.importances_mean[i]), 5)} for i in order]

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
    cm = confusion_matrix(yte, pred_te, labels=[0, 1])
    axes[0].imshow(cm, cmap="Blues")
    for i in range(2):
        for j in range(2):
            axes[0].text(j, i, int(cm[i, j]), ha="center", va="center")
    axes[0].set_xticks([0, 1])
    axes[0].set_yticks([0, 1])
    axes[0].set_xlabel("Predicted")
    axes[0].set_ylabel("Actual")
    axes[0].set_title("Confusion matrix (test)")
    fpr, tpr, _ = roc_curve(yte, prob_te)
    axes[1].plot(fpr, tpr, color="#2f6f9f", label="AUC " + format(test["auc"], ".3f"))
    axes[1].plot([0, 1], [0, 1], "--", color="grey", label="Naive")
    axes[1].set_xlabel("False positive rate")
    axes[1].set_ylabel("True positive rate")
    axes[1].set_title("ROC (test)")
    axes[1].legend()
    save_fig(fig, P.REPORTS_DIR / CHARTS["model_eval"])
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh([d["feature"] for d in importances][::-1], [d["importance"] for d in importances][::-1], color="#2f6f9f")
    ax.set_title("Top features by permutation importance (test AUC drop)")
    save_fig(fig, P.REPORTS_DIR / CHARTS["importance"])

    allp = pipe.predict_proba(X)[:, 1]
    split = np.array(["train"] * len(df), dtype=object)
    split[te] = "test"
    out = pd.DataFrame({"row_id": df["row_id"], "split": split, "pred_abuse": (allp >= 0.5).astype(int),
                        "pred_prob": np.round(allp, 4)})
    out.to_csv(P.FILES["predictions"], index=False, encoding="utf-8")
    save_model(pipe, P.FILES["model_file"])
    save_json({"numeric": num, "categorical": cat}, P.FILES["feature_list"])
    save_json({"task": "classification", "target": N["abuse_flag"], "split_method": "grouped by customer" if use_groups else "stratified",
               "random_state": RANDOM_STATE, "n_train": int(len(Xtr)), "n_test": int(len(Xte)),
               "positive_rate": float(y.mean()), "models": results, "best_model": best, "cv_folds": folds,
               "cv_note": "cross-validation scores come from training rows only",
               "baseline": {"majority_accuracy": majority_acc, "rule_accuracy": rule_acc, "naive_auc": 0.5},
               "test": test, "beats_baseline": bool(beats), "low_sample": bool(low_sample),
               "leakage_drops": dropped, "feature_cols": cols, "importances": importances},
              P.FILES["metrics"])
    if verbose and not beats:
        print("Result is no better than the naive baseline.")
    return results
