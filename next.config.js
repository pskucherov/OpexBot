// /** @type {import('next').NextConfig} */
// const fs = require('fs');
// const { join } = require('path');
// const path = require('path');

// // Когда opexviewer лежит рядом с opexbot
// const moduleDist = path.join('../', 'opexviewer');

// // Когда opexviewer лежит внутри node_modules
// const packageDist = path.join('./', 'node_modules', 'opexviewer');

// const PROJECT_ROOT = fs.existsSync(moduleDist) ? moduleDist : packageDist;

// console.log(path.resolve(packageDist));

// const nextConfig = {
//     reactStrictMode: true,
//     // distDir: path.join(PROJECT_ROOT, 'build'),
//     // basePath: path.resolve(PROJECT_ROOT),
//     serverRuntimeConfig: {
//         PROJECT_ROOT: path.resolve(PROJECT_ROOT)
//     }
// };

// module.exports = nextConfig;
