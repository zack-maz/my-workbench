#!/usr/bin/env python3
"""Check the classifier against the captured Bob Shell screens in fixtures/.

    python3 test-rules.py

Add a fixture named <state>-<whatever>.txt when bob or bob2 grows a screen the
rules miss; the expected state is read from the filename prefix.
"""

import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import importlib.util

spec = importlib.util.spec_from_file_location(
    "bobshell_state",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "bobshell-state.py"),
)
bobshell_state = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bobshell_state)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    fixtures = sorted(glob.glob(os.path.join(here, "fixtures", "*.txt")))
    if not fixtures:
        print("no fixtures found")
        return 1

    failures = 0
    for path in fixtures:
        name = os.path.basename(path)
        expected = name.split("-", 1)[0]
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
        state, message = bobshell_state.classify(text)
        tokens = bobshell_state.status_tokens(text)
        shown = " ".join(
            "%s=%s" % (key, value)
            for key, value in sorted(tokens.items())
            if value is not None
        )
        ok = state == expected
        failures += 0 if ok else 1
        print(
            "%s %-30s expected=%-8s got=%-8s message=%-32s %s"
            % ("PASS" if ok else "FAIL", name, expected, state, message, shown)
        )

    print("\n%d fixture(s), %d failure(s)" % (len(fixtures), failures))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
