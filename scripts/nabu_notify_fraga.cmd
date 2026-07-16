@echo off
REM Skickar fråge-notis till Nabu/Galaxy Watch. Anropar nabu_notify_fraga.ps1.
REM Miljövariabler:
REM   NABU_WEBHOOK_URL       (valfri i miljö) — annars läses från .cursor\rules\nabu-webhook.local.mdc av ps1
REM   NABU_QUESTION_SUMMARY  (valfri) — kort mening; annars läses .cursor\nabu_question_context.txt
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0nabu_notify_fraga.ps1" %*
exit /b %ERRORLEVEL%
