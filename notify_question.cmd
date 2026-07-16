@echo off
REM Kortkommando i projektrot: fråge-notis till Nabu/Galaxy Watch.
REM Sparar sammanfattning som UTF-8 och skickar notis via notify_question.ps1.
REM Exempel: notify_question.cmd val av exportformat för bilaga 1
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\notify_question.ps1" %*
exit /b %ERRORLEVEL%
