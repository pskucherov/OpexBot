#!/usr/bin/env node
const path = require('path');
const concurrently = require('concurrently');

concurrently([
    { command: 'npx next start', name: 'opexviewer' },
    { command: 'node src/main', name: 'opexbot' },
], {
    prefix: 'name',
    killOthers: ['failure', 'success'],
    restartTries: 3,
    cwd: path.resolve(__dirname),
});
