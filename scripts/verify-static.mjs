import {
    access,
    stat
} from "node:fs/promises";

import {
    constants
} from "node:fs";

const requiredFiles = [
    "index.html",
    "create.html",
    "training.html",

    "assets/config.js",
    "assets/api.js",
    "assets/admin.js",
    "assets/create.js",
    "assets/training.js",
    "assets/style.css",

    "vendor/ol.js",
    "vendor/ol.css",

    ".nojekyll"
];

let failed = false;

for (const file of requiredFiles) {
    try {
        await access(file, constants.F_OK);

        const info = await stat(file);

        if (info.isFile() && info.size === 0 && file!=".nojekyll") {
            console.error(
                `FAIL: ${file} существует, но пустой.`
            );

            failed = true;

            continue;
        }

        console.log(`OK: ${file}`);
    } catch {
        console.error(
            `FAIL: не найден обязательный файл ${file}`
        );

        failed = true;
    }
}

if (failed) {
    process.exit(1);
}

console.log("Static deployment check passed.");