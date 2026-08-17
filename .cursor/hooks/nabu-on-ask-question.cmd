@echo off
REM Cursor postToolUse-hook: fråge-notis vid AskQuestion (Windows).
chcp 65001 >nul
cd /d "%~dp0..\..\"
for /f "delims=" %%i in ('where node 2^>nul') do set "NODE_EXE=%%i" & goto :run
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
:run
"%NODE_EXE%" ".cursor\hooks\nabu_on_ask_question.mjs"
exit /b %ERRORLEVEL%
