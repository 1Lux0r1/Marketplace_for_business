@echo off
rem Build and run the app. Keep this window open - closing it stops the app.
rem The outbox worker is not started here: it does nothing until task 01-3.
setlocal
cd /d "%~dp0..\.."

call pnpm build
if errorlevel 1 (
  echo.
  echo Build failed. The app was not started.
  exit /b 1
)

echo.
echo Starting on http://localhost:3000 - keep this window open.
echo Confirmation codes are printed here: search for "body".
echo.
call pnpm start
