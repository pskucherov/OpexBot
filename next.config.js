/** @type {import('next').NextConfig} */
const fs = require('fs');

// Когда opexviewer лежит рядом с opexbot
const moduleDist = '../opexviewer/build';

// Когда opexviewer лежит внутри node_modules
const packageDist = 'node_modules/opexviewer/build';

const nextConfig = {
    reactStrictMode: true,
    distDir: fs.existsSync(moduleDist) ? moduleDist : packageDist,
};

module.exports = nextConfig;
