import {
    copyFile,
    mkdir
} from "node:fs/promises";

import {
    access,
    constants
} from "node:fs/promises";

import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = [
    {
        from: "node_modules/ol/dist/ol.js",
        to: "vendor/ol.js"
    },

    {
        from: "node_modules/ol/ol.css",
        to: "vendor/ol.css"
    }
];

async function assertExists(filePath) {
    try {
        await access(filePath, constants.F_OK);
    } catch {
        throw new Error(
            `Не найден файл: ${filePath}\n` +
            "Сначала выполните: npm install"
        );
    }
}

async function copyVendorFile(file) {
    const source = path.join(root, file.from);
    const destination = path.join(root, file.to);

    await assertExists(source);

    await mkdir(
        path.dirname(destination),
        {
            recursive: true
        }
    );

    await copyFile(source, destination);

    console.log(
        `Copied: ${file.from} -> ${file.to}`
    );
}

for (const file of files) {
    await copyVendorFile(file);
}

console.log("OpenLayers vendor files are ready.");