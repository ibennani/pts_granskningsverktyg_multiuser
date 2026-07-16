@echo off
REM Sparar kort sammanfattning för fråge-notis (läses av notify_question.ps1 / nabu_notify_fraga.ps1).
REM Användning från projektrot: scripts\set_nabu_question.cmd om planen ska uppdateras
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set_nabu_question.ps1" %*
exit /b %ERRORLEVEL%
