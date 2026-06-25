@echo off
REM Deploy testserver till /test-server/ utan att röra prod /v2/
setlocal
cd /d "%~dp0.."
set DEPLOY_USER=localiliben
set DEPLOY_SSH_HOSTNAME=ux-granskningsverktyg.pts.ad
set DEPLOY_TEST_SERVER_COPY_ENV=1
call npm run deploy:test-server
exit /b %ERRORLEVEL%
