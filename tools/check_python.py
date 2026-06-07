from __future__ import annotations

import pathlib
import sys


def main() -> int:
    failed = False
    for raw_path in sys.argv[1:]:
        path = pathlib.Path(raw_path)
        try:
            source = path.read_text(encoding="utf-8")
            compile(source, str(path), "exec")
        except SyntaxError as exc:
            failed = True
            print(f"{path}:{exc.lineno}:{exc.offset}: {exc.msg}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
