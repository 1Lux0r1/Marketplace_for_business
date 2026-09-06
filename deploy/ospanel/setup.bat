@echo off
rem Kодировка: без chcp консоль Windows покажет вместо русских букв мусор.
rem Файл сохранён в UTF-8 без BOM — с BOM cmd спотыкается на первой строке.
chcp 65001 >nul
setlocal
cd /d "%~dp0..\.."

echo.
echo   Настройка маркетплейса. Это займёт несколько минут.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   ------------------------------------------------
  echo   На компьютере нет Node.js — без него не запустить.
  echo.
  echo   Откройте сайт  nodejs.org
  echo   Скачайте версию LTS, установите
  echo   и запустите этот файл снова.
  echo   ------------------------------------------------
  echo.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo   Ставлю pnpm...
  call npm install -g pnpm
  if errorlevel 1 (
    echo.
    echo   Не получилось поставить pnpm. Пришлите текст выше.
    pause
    exit /b 1
  )
)

call pnpm install
if errorlevel 1 (
  echo.
  echo   Не получилось поставить библиотеки. Пришлите текст выше.
  pause
  exit /b 1
)

call node scripts\local-setup.mjs
if errorlevel 1 (
  pause
  exit /b 1
)

pause
