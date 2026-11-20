#!/usr/bin/env python3
"""Fail CI when the temporal browser report contains a failed check or unexpected traffic."""
import json
import sys
from pathlib import Path

def failures(result):
    errors = []
    for scenario in ("leitor_premium", "questao_premium", "treino_gratis"):
        data = result.get(scenario)
        if not isinstance(data, dict):
            errors.append(scenario + ": missing")
            continue
        if not any(isinstance(value, bool) for value in data.values()):
            errors.append(scenario + ": missing assertions")
        for key, value in data.items():
            if value is False or (key in ("exception", "console_errors", "unexpected_network") and value):
                errors.append(scenario + ": " + key)
    calls = result.get("rpc_calls", [])
    if not calls or any(not call.endswith(":ok") for call in calls):
        errors.append("RPC execution missing or failed")
    return errors

if __name__ == "__main__":
    result = json.loads(Path(sys.argv[1]).read_text())
    errors = failures(result)
    if errors:
        print("FAIL: " + "; ".join(errors), file=sys.stderr)
        raise SystemExit(1)
    print("PASS: all reported browser assertions, console and RPC checks")
