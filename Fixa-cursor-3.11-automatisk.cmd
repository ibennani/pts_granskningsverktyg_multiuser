@echo off
setlocal EnableDelayedExpansion
title Fixa Cursor 3.11 - automatisk
color 0A

set "ILIBEN_CURSOR=C:\Users\iliben\.cursor"
set "ILIBEN_BACKUP=C:\Users\iliben\.cursor.localprofile.backup-full"
set "USER_DATA=C:\Users\iliben\AppData\Roaming\Cursor"
set "USER_DIR=%USER_DATA%\User"
set "GLOBAL_STORAGE=%USER_DIR%\globalStorage"
set "STATE_DB=%GLOBAL_STORAGE%\state.vscdb"
set "BACKUP_ROOT=%USER_DATA%\profil-backup"
set "CURSOR_HOME=%USERPROFILE%\.cursor"
set "STAMP=%DATE:~-4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%"
set "STAMP=%STAMP: =0%"
set "BACKUP_DIR=%BACKUP_ROOT%\%STAMP%"
set "ARG=--user-data-dir=C:\Users\iliben\AppData\Roaming\Cursor"

echo.
echo  ============================================================
echo   Fixa Cursor 3.11 - behaller inställningar, nollstaller cache
echo  ============================================================
echo.
echo  Stang Cursor nu ^(File - Exit eller Alt+F4^).
echo  Detta fonster vantar och gor resten automatiskt.
echo.

set /a WAIT_COUNT=0
:wait_for_close
tasklist /FI "IMAGENAME eq Cursor.exe" 2>nul | find /I "Cursor.exe" >nul
if %ERRORLEVEL%==0 (
    set /a WAIT_COUNT+=1
    if !WAIT_COUNT! GEQ 600 (
        echo Timeout: Cursor stangs inte. Avbryter.
        pause
        exit /b 1
    )
    if !WAIT_COUNT!==1 echo  Vantar pa att Cursor stangs ...
    timeout /t 2 /nobreak >nul
    goto wait_for_close
)

echo  Cursor ar stangd. Vantar 3 sekunder ...
timeout /t 3 /nobreak >nul

if not exist "%USER_DIR%\settings.json" (
    echo FEL: Hittar inte profil: %USER_DIR%
    pause
    exit /b 1
)

mkdir "%BACKUP_DIR%" 2>nul
echo.
echo [1/5] Sakerhetskopierar inställningar ...
copy /Y "%USER_DIR%\settings.json" "%BACKUP_DIR%\settings.json" >nul
if exist "%USER_DIR%\keybindings.json" copy /Y "%USER_DIR%\keybindings.json" "%BACKUP_DIR%\keybindings.json" >nul
if exist "%USER_DIR%\snippets" robocopy "%USER_DIR%\snippets" "%BACKUP_DIR%\snippets" /E /R:1 /W:1 /NFL /NDL /NJH /NJS >nul

echo [2/5] Nollstaller gammal cache (state.vscdb) ...
if exist "%STATE_DB%" (
    for %%A in ("%STATE_DB%") do set "STATE_MB=%%~zA"
    set /a STATE_MB=!STATE_MB!/1048576
    echo        Flyttar ca !STATE_MB! MB till backup ...
    move /Y "%STATE_DB%" "%BACKUP_DIR%\state.vscdb" >nul 2>&1
    if exist "%STATE_DB%-wal" move /Y "%STATE_DB%-wal" "%BACKUP_DIR%\state.vscdb-wal" >nul 2>&1
    if exist "%STATE_DB%-shm" move /Y "%STATE_DB%-shm" "%BACKUP_DIR%\state.vscdb-shm" >nul 2>&1
) else (
    echo        Ingen state.vscdb att flytta.
)

echo [3/5] Synkar planer, MCP och regler ...
if exist "%ILIBEN_CURSOR%" (
    dir /AL "%ILIBEN_CURSOR%" >nul 2>&1
    if !ERRORLEVEL!==0 (
        for /f %%C in ('dir /s /b "%ILIBEN_CURSOR%\plans\*.plan.md" 2^>nul ^| find /c /v ""') do set PLAN_COUNT=%%C
        if not defined PLAN_COUNT set PLAN_COUNT=0
        if "!PLAN_COUNT!"=="0" (
            rmdir "%ILIBEN_CURSOR%" 2>nul
            if exist "%ILIBEN_BACKUP%" ren "%ILIBEN_BACKUP%" ".cursor"
        )
    )
)
if exist "%ILIBEN_CURSOR%\plans" (
    if not exist "%CURSOR_HOME%" mkdir "%CURSOR_HOME%"
    robocopy "%ILIBEN_CURSOR%" "%CURSOR_HOME%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS >nul
) else (
    echo        Hoppar over .cursor-synk ^(plans saknas^).
)

echo [4/5] Hittar Cursor 3.11 och uppdaterar genvagar ...
for /f "delims=" %%E in ('powershell -NoProfile -Command ^
  "$candidates=@(" ^
  "'$env:LOCALAPPDATA\Programs\cursor\Cursor.exe'," ^
  "'C:\Users\LOCALILIBEN.PTS\AppData\Local\Programs\cursor\Cursor.exe'," ^
  "'C:\Users\iliben\AppData\Local\Programs\cursor\Cursor.exe'," ^
  "'C:\Program Files\cursor\Cursor.exe'" ^
  "); $found=$candidates | Where-Object { Test-Path $_ } | ForEach-Object { Get-Item $_ } | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if($found){ $found.FullName }"') do set "CURSOR_EXE=%%E"

if not defined CURSOR_EXE (
    echo FEL: Hittar inte Cursor.exe
    pause
    exit /b 1
)
echo        Anvander: %CURSOR_EXE%

powershell -NoProfile -Command ^
  "$exe='%CURSOR_EXE%'; $arg='%ARG%'; $shell=New-Object -ComObject WScript.Shell; " ^
  "$paths=@(" ^
  "[Environment]::GetFolderPath('Desktop')+'\Cursor.lnk'," ^
  "[Environment]::GetFolderPath('ApplicationData')+'\Microsoft\Windows\Start Menu\Programs\Cursor\Cursor.lnk'," ^
  "[Environment]::GetFolderPath('ApplicationData')+'\Microsoft\Windows\Start Menu\Programs\Cursor.lnk'" ^
  "); foreach($p in $paths){ $s=$shell.CreateShortcut($p); $s.TargetPath=$exe; $s.Arguments=$arg; $s.Description='Cursor med iliben-profil'; $s.Save() }"

echo [5/5] Startar Cursor ...
start "" "%CURSOR_EXE%" %ARG%

echo.
echo  ============================================================
echo   KLART
echo  ============================================================
echo.
echo  Inställningar behallna. Gammal cache borttagen.
echo  Backup: %BACKUP_DIR%
echo.
echo  Testa nya funktioner i Agents Window:
echo    - File - New Agents Window
echo    - /side eller /btw for side chat
echo    - Ctrl+K for sok i transkript
echo.
echo  Detta fonster stangs om 15 sekunder ...
timeout /t 15 /nobreak >nul
endlocal
