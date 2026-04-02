@echo off
REM Skickar klar-notis till Nabu/Galaxy Watch. Anropar nabu_notify.ps1.
REM Miljövariabler:
REM   NABU_WEBHOOK_URL  (valfri i miljö) — annars läses från .cursor\rules\nabu-webhook.local.mdc av ps1
REM   NABU_TASK_LABEL   (valfri) — kort uppgiftsbeskrivning; annars läses .cursor\nabu_task_context.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0nabu_notify.ps1"
exit /b %ERRORLEVEL%
