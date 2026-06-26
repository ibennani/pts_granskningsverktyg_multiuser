#!/usr/bin/env node
import 'dotenv/config';
import { exec, disconnect } from './deploy-utils.js';

const script = [
    "grep -oE 'main-[A-Za-z0-9_-]+\\.js' /var/www/granskningsverktyget-v2/sw.js | sort -u",
    "grep -oE 'main-[A-Za-z0-9_-]+\\.js' /var/www/granskningsverktyget-v2/index.html",
    "wc -c /var/www/granskningsverktyget-v2/assets/main-*.js",
].join(' && ');

await exec(script, { cwd: false });
await disconnect();
