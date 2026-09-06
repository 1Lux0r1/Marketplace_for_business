@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0..\.."

echo.
echo   Обновление маркетплейса.
echo.

if not exist ".git" (
  echo   ------------------------------------------------
  echo   Эта папка скачана архивом, а не через Git —
  echo   обновиться на месте не получится.
  echo.
  echo   Скачайте архив заново с GitHub, распакуйте
  echo   поверх и запустите setup.bat
  echo.
  echo   Чтобы обновляться одним щелчком, поставьте Git
  echo   с сайта  git-scm.com  и скажите мне — я объясню,
  echo   как переехать. Это делается один раз.
  echo   ------------------------------------------------
  echo.
  pause
  exit /b 1
)

call git pull
if errorlevel 1 (
  echo.
  echo   Не получилось забрать обновление. Пришлите текст выше.
  pause
  exit /b 1
)

call pnpm install
if errorlevel 1 (
  echo.
  echo   Не получилось обновить библиотеки. Пришлите текст выше.
  pause
  exit /b 1
)

call node scripts\local-setup.mjs
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo   Обновлено. Запускайте start.bat
echo.
pause
