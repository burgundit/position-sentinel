# Development Guide

## Repository Layout

- `app/`: Browser UI
- `app/modules/`: Frontend modules for API calls, DOM references, scoring fallback, holdings, symbols, and utilities
- `backend/`: Python backend package
- `backend/server.py`: HTTP server, API routes, portfolio analysis, market/news data
- `backend/symbols.py`: Server-side aliases, ticker normalization, KRX/Yahoo symbol search
- `server.py`: Thin entry point kept so `python server.py` continues to work
- `tools/`: Local helper scripts used by VS Code tasks and CI
- `.github/`: GitHub Actions and contribution templates
- `.vscode/`: Shared VS Code workspace tasks and recommendations
- `data/`: Local runtime data; JSON files are ignored by Git

## VS Code Tasks

Open `Terminal > Run Task...`.

- `Run server`: Starts the local Python server
- `Check Python syntax`: Checks backend Python files
- `Check JS syntax`: Checks frontend JavaScript modules
- `Check all`: Runs Python checks, JavaScript checks, and Git status
- `Git status`: Shows the current Git state

## Local Checks

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check-python.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check-js.ps1
```

## GitHub

GitHub Actions runs the same Python and JavaScript syntax checks on push and pull request.
