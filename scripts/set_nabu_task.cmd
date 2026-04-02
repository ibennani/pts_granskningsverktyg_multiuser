@echo off
REM Sparar kort beskrivning av aktuell uppgift (läses när nabu_notify körs).
REM Användning från projektrot: scripts\set_nabu_task.cmd Granskar router och tester
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set_nabu_task.ps1" %*
exit /b %ERRORLEVEL%
