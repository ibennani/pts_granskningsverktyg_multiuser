@echo off
REM Cursor afterAgentResponse-hook: sparar agentsvar (Windows).
cd /d "%~dp0..\..\"
for /f "delims=" %%i in ('where node 2^>nul') do set "NODE_EXE=%%i" & goto :run
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
:run
"%NODE_EXE%" ".cursor\hooks\nabu_on_after_agent_response.mjs"
exit /b %ERRORLEVEL%
