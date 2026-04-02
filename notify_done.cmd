@echo off
REM Kortkommando i projektrot: klar-notis till Nabu/Galaxy Watch. Anropar scripts\nabu_notify.cmd.
cd /d "%~dp0"
call scripts\nabu_notify.cmd
exit /b %ERRORLEVEL%
