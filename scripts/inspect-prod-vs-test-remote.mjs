#!/usr/bin/env node
import 'dotenv/config';
import { exec, disconnect } from './deploy-utils.js';

const script = [
    "echo '=== PROD v2 ==='",
    "grep main- /var/www/granskningsverktyget-v2/index.html",
    "head -6 /var/www/granskningsverktyget-v2/build-info.js",
    "grep -c get_view_heading_label /var/www/granskningsverktyget-v2/assets/main-*.js || true",
    "grep -c 'overflow: hidden' /var/www/granskningsverktyget-v2/css/theme-dark-experimental.css || true",
    "grep -c critical_notice_banner /var/www/granskningsverktyget-v2/assets/main-*.js || true",
    "echo '=== TEST test-server ==='",
    "grep main- /var/www/granskningsverktyget-test-server/index.html 2>/dev/null || true",
    "head -6 /var/www/granskningsverktyget-test-server/build-info.js 2>/dev/null || true",
    "grep -c get_view_heading_label /var/www/granskningsverktyget-test-server/assets/main-*.js 2>/dev/null || true",
].join(' && ');

await exec(script, { cwd: false });
await disconnect();
