@echo off
REM Engångs-/om-seed + deploy av testserver på prod.
REM Kräver: .env.test-server, DEPLOY_SSH_PASSWORD i .env, lokal Docker med Postgres.
setlocal
cd /d "%~dp0.."

if not exist ".env.test-server" (
    echo Fel: .env.test-server saknas. Se docs\deploy-test-server-setup.md
    exit /b 1
)

echo [setup-test-server] Steg 1/2: seed fran lokal miljo...
call npm run seed:test-server -- --confirm
if errorlevel 1 exit /b 1

echo [setup-test-server] Steg 2/2: deploy testserver...
set DEPLOY_TEST_SERVER_COPY_ENV=1
call npm run deploy:test-server
exit /b %ERRORLEVEL%
