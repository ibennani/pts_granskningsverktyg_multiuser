@echo off
setlocal
rem Startar Cursor med din sparade profil under C:\Users\iliben
rem (inställningar, tillägg, historik, planer, MCP, regler)

set "CURSOR_EXE=%LOCALAPPDATA%\Programs\cursor\Cursor.exe"
set "ILIBEN_USER_DATA=C:\Users\iliben\AppData\Roaming\Cursor"

if not exist "%CURSOR_EXE%" (
    echo Kunde inte hitta Cursor:
    echo   %CURSOR_EXE%
    echo.
    echo Kontrollera att Cursor ar installerat.
    pause
    exit /b 1
)

if not exist "%ILIBEN_USER_DATA%" (
    echo Kunde inte hitta iliben-profilen:
    echo   %ILIBEN_USER_DATA%
    pause
    exit /b 1
)

start "" "%CURSOR_EXE%" --user-data-dir="%ILIBEN_USER_DATA%" %*

endlocal
