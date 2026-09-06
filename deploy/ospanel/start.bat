@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0..\.."

echo.
echo   Собираю приложение. Первый раз это минута-две.
echo.

call pnpm build
if errorlevel 1 (
  echo.
  echo   Сборка не прошла, приложение не запущено.
  echo   Пришлите текст выше.
  pause
  exit /b 1
)

echo.
echo   ==================================================
echo     Откройте в браузере:  http://localhost:3000
echo.
echo     ЭТО ОКНО ЗАКРЫВАТЬ НЕЛЬЗЯ — закроете, и сайт
echo     перестанет открываться.
echo.
echo     Код подтверждения при регистрации появится
echo     здесь же: ищите слово "body".
echo   ==================================================
echo.

call pnpm start
pause
