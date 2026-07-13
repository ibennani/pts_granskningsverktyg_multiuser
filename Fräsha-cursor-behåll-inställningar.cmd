@echo off
setlocal EnableDelayedExpansion
rem Nollstaller gammal Cursor-cache (state.vscdb) men behaller inställningar.
rem Anvand nar nya funktioner inte syns efter profilkopiering eller uppgradering.

set "USER_DATA=C:\Users\iliben\AppData\Roaming\Cursor"
set "USER_DIR=%USER_DATA%\User"
set "GLOBAL_STORAGE=%USER_DIR%\globalStorage"
set "STATE_DB=%GLOBAL_STORAGE%\state.vscdb"
set "BACKUP_ROOT=%USER_DATA%\profil-backup"
set "STAMP=%DATE:~-4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%"
set "STAMP=%STAMP: =0%"
set "BACKUP_DIR=%BACKUP_ROOT%\%STAMP%"

tasklist /FI "IMAGENAME eq Cursor.exe" 2>nul | find /I "Cursor.exe" >nul
if %ERRORLEVEL%==0 (
    echo Stang Cursor helt forst ^(kolla Aktivitetshanteraren^), kor sedan detta skript igen.
    pause
    exit /b 1
)

if not exist "%USER_DIR%\settings.json" (
    echo Kunde inte hitta profil:
    echo   %USER_DIR%
    pause
    exit /b 1
)

mkdir "%BACKUP_DIR%" 2>nul

echo Sparar inställningar till backup ...
copy /Y "%USER_DIR%\settings.json" "%BACKUP_DIR%\settings.json" >nul
if exist "%USER_DIR%\keybindings.json" copy /Y "%USER_DIR%\keybindings.json" "%BACKUP_DIR%\keybindings.json" >nul
if exist "%USER_DIR%\snippets" robocopy "%USER_DIR%\snippets" "%BACKUP_DIR%\snippets" /E /R:1 /W:1 /NFL /NDL /NJH /NJS >nul

if exist "%STATE_DB%" (
    for %%A in ("%STATE_DB%") do set "STATE_MB=%%~zA"
    set /a STATE_MB=!STATE_MB!/1048576
    echo.
    echo Hittade state.vscdb: ca !STATE_MB! MB
    echo Flyttar till backup ^(frigör plats, nollstaller gammalt tillstand^) ...
    move /Y "%STATE_DB%" "%BACKUP_DIR%\state.vscdb" >nul
    if exist "%STATE_DB%-wal" move /Y "%STATE_DB%-wal" "%BACKUP_DIR%\state.vscdb-wal" >nul
    if exist "%STATE_DB%-shm" move /Y "%STATE_DB%-shm" "%BACKUP_DIR%\state.vscdb-shm" >nul
) else (
    echo state.vscdb fanns inte - inget att nollstalla.
)

echo.
echo Klart.
echo.
echo BEHALLS:
echo   - settings.json, keybindings.json, snippets
echo   - tillagg i profilmappen
echo   - planer/regler under C:\Users\iliben\.cursor
echo.
echo BACKUP:
echo   %BACKUP_DIR%
echo.
echo NASTA STEG:
echo   1. Starta Cursor fran Start-menyn
echo   2. Oppna Agents Window ^(File - New Agents Window^)
echo   3. Testa /side eller Ctrl+K i Agents Window
echo.
echo Vill du aven synka .cursor-planer och Start-genvagar, kor sedan:
echo   Återställ-cursor-profil.cmd
echo.
pause
endlocal
