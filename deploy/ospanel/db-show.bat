@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0..\.."
call pnpm db:show
echo.
pause
