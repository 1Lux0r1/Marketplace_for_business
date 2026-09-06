@echo off
rem First run on a local Windows machine: dependencies, .env, databases, schema.
rem Safe to run again: it does not overwrite .env and does not drop anything.
rem Step-by-step guide (in Russian): docs\13-local-server.md
setlocal
cd /d "%~dp0..\.."

where pnpm >nul 2>nul
if errorlevel 1 (
  echo.
  echo pnpm not found.
  echo Install Node.js 22+ from nodejs.org, then run: npm install -g pnpm
  exit /b 1
)

call pnpm install
if errorlevel 1 exit /b 1

call node scripts\local-setup.mjs
if errorlevel 1 exit /b 1

echo.
echo Next: run start.bat
