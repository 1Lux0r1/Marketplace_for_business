@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem Настраивает адрес marketplace.local в Open Server Panel 6.
rem
rem Отдельным файлом, потому что Проводник Windows отказывается создавать
rem папку с именем, начинающимся с точки, а панели нужна именно такая —
rem .osp внутри папки домена.

set "PANEL=C:\OSPanel"
if not "%~1"=="" set "PANEL=%~1"
set "DOMAIN=%PANEL%\home\marketplace.local"

echo.
echo   Настройка адреса marketplace.local
echo.

if not exist "%PANEL%\home" (
  echo   ------------------------------------------------
  echo   Не нашёл Open Server Panel в папке %PANEL%
  echo.
  echo   Если панель установлена в другом месте, перетащите
  echo   её папку на этот файл мышью — он возьмёт путь оттуда.
  echo   ------------------------------------------------
  echo.
  pause
  exit /b 1
)

if not exist "%DOMAIN%\.osp" mkdir "%DOMAIN%\.osp"
if errorlevel 1 (
  echo   Не получилось создать папку %DOMAIN%\.osp
  pause
  exit /b 1
)

copy /y "project.ini" "%DOMAIN%\.osp\project.ini" >nul
if errorlevel 1 (
  echo   Не получилось скопировать настройки домена.
  pause
  exit /b 1
)

echo   Готово. Настройки лежат здесь:
echo   %DOMAIN%\.osp\project.ini
echo.
echo   Осталось два действия:
echo     1. Перезапустить Open Server Panel
echo     2. Открыть в браузере  http://marketplace.local
echo.
echo   Сайт при этом должен быть запущен через start.bat —
echo   панель только передаёт ему запросы, но не запускает его.
echo.
pause
