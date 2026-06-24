@echo off
REM Deploy testserver till /test-server/ utan att röra prod /v2/
setlocal
cd /d "%~dp0.."
set DEPLOY_SSH_ALIAS=granskning
set DEPLOY_USER=localiliben
set DEPLOY_SSH_HOSTNAME=ux-granskningsverktyg.pts.ad
call npm run deploy:test-server
exit /b %ERRORLEVEL%
