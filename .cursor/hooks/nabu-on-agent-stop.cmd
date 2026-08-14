@echo off
REM Cursor stop-hook: skickar klar-notis (Windows).
cd /d "%~dp0..\..\"
for /f "delims=" %%i in ('where node 2^>nul') do set "NODE_EXE=%%i" & goto :run
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
:run
"%NODE_EXE%" ".cursor\hooks\nabu_on_agent_stop.mjs"
exit /b %ERRORLEVEL%
