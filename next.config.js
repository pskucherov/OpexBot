// /** @type {import('next').NextConfig} */
// const nextConfig = {
//     reactStrictMode: false,
//     distDir: './node_modules/opexviewer/build',
// };

// module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const fs = require('fs');
const path = require('path');

const moduleBuildDist = path.join('../', '../', 'opexviewer');

// Когда opexviewer лежит рядом с opexbot
const moduleDist = path.join('../', 'opexviewer');

// Когда opexviewer лежит внутри node_modules
const packageDist = path.join('./', 'node_modules', 'opexviewer');

const PROJECT_ROOT = fs.existsSync(path.resolve(__dirname, moduleBuildDist)) ?
    moduleBuildDist : fs.existsSync(path.resolve(__dirname, moduleDist)) ? moduleDist : packageDist;

const nextConfig = {
    reactStrictMode: false,
    distDir: path.join(PROJECT_ROOT, 'build'),

    // basePath: path.resolve(PROJECT_ROOT),
    // serverRuntimeConfig: {
    //     PROJECT_ROOT: path.resolve(PROJECT_ROOT)
    // }
};

module.exports = nextConfig;
