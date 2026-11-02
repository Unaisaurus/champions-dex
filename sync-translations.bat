@echo off
rem ============================================================
rem  Champions Dex - update the translation files
rem  Adds new text keys (empty) to the hand-made translation files
rem  and lists keys that are no longer used. It never deletes or
rem  changes your translations.
rem ============================================================
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed yet. Download the LTS version from https://nodejs.org
  pause
  exit /b 1
)
call npm install --no-audit --no-fund --loglevel=error
call npm run translations:sync
pause
