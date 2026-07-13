@echo off
setlocal
rem Saker aterstallning UTAN junction (junction har orsakat att Cursor inte startar).
rem Synkar C:\Users\iliben\.cursor till din nuvarande profil och satter Start-genvag.

set "ILIBEN_CURSOR=C:\Users\iliben\.cursor"
set "ILIBEN_BACKUP=C:\Users\iliben\.cursor.localprofile.backup-full"
set "CURSOR_HOME=%USERPROFILE%\.cursor"
set "CURSOR_EXE=%LOCALAPPDATA%\Programs\cursor\Cursor.exe"
set "ILIBEN_USER_DATA=C:\Users\iliben\AppData\Roaming\Cursor"
set "ARG=--user-data-dir=\"C:\Users\iliben\AppData\Roaming\Cursor\""

tasklist /FI "IMAGENAME eq Cursor.exe" 2>nul | find /I "Cursor.exe" >nul
if %ERRORLEVEL%==0 (
    echo Stang Cursor helt forst, kor sedan detta skript igen.
    pause
    exit /b 1
)

rem Reparera trasig iliben\.cursor om den ar en tom junction
if exist "%ILIBEN_CURSOR%" (
    dir /AL "%ILIBEN_CURSOR%" >nul 2>&1
    if %ERRORLEVEL%==0 (
        for /f %%C in ('dir /s /b "%ILIBEN_CURSOR%\plans\*.plan.md" 2^>nul ^| find /c /v ""') do set PLAN_COUNT=%%C
        if not defined PLAN_COUNT set PLAN_COUNT=0
        if "%PLAN_COUNT%"=="0" (
            echo Reparerar trasig iliben\.cursor ...
            rmdir "%ILIBEN_CURSOR%" 2>nul
            if exist "%ILIBEN_BACKUP%" (
                ren "%ILIBEN_BACKUP%" ".cursor"
            )
        )
    )
)

if not exist "%ILIBEN_CURSOR%\plans" (
    echo Kunde inte hitta giltig iliben-profil:
    echo   %ILIBEN_CURSOR%
    pause
    exit /b 1
)

if not exist "%CURSOR_HOME%" mkdir "%CURSOR_HOME%"

echo Synkar planer, projekt, MCP och regler fran iliben ...
robocopy "%ILIBEN_CURSOR%" "%CURSOR_HOME%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS
rem robocopy exit 0-7 = ok

if not exist "%CURSOR_EXE%" (
    echo Varning: Cursor.exe saknas pa:
    echo   %CURSOR_EXE%
    echo Installera Cursor eller justera sokvagen.
) else (
    echo Uppdaterar Start-meny-genvagar ...
    powershell -NoProfile -Command ^
      "$arg='%ARG%'; $shell=New-Object -ComObject WScript.Shell; " ^
      "$paths=@([Environment]::GetFolderPath('ApplicationData')+'\Microsoft\Windows\Start Menu\Programs\Cursor\Cursor.lnk', [Environment]::GetFolderPath('ApplicationData')+'\Microsoft\Windows\Start Menu\Programs\Cursor.lnk'); " ^
      "foreach($p in $paths){ if(Test-Path $p){ $s=$shell.CreateShortcut($p); $s.Arguments=$arg; $s.Description='Cursor med iliben-profil'; $s.Save() } }"
)

echo.
echo Klart. Starta Cursor fran Start-menyn.
echo Inställningar laddas fran: %ILIBEN_USER_DATA%
echo Planer/projekt synkade till: %CURSOR_HOME%
pause
endlocal
