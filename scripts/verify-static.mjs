/**
 * Проверка перед публикацией на GitHub Pages: все файлы, на которые ссылаются
 * страницы, лежат в репозитории и не пустые, а в конфиге не осталось
 * незаполненных placeholder-ов.
 */
import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
    'index.html',
    'training.html',
    'create.html',

    'styles/base.css',
    'styles/layout.css',
    'styles/components.css',
    'styles/pages.css',

    'src/config.js',

    'src/core/dom.js',
    'src/core/columns.js',
    'src/core/format.js',
    'src/core/auth.js',
    'src/core/sheets.js',

    'src/data/trainings.js',
    'src/data/comments.js',

    'src/features/map.js',
    'src/features/weather.js',
    'src/features/announcement.js',

    'src/views/training-card.js',
    'src/views/training-hero.js',
    'src/views/comments.js',
    'src/views/creation-result.js',

    'src/pages/home.js',
    'src/pages/training.js',
    'src/pages/create.js',

    'assets/club-logo.jpg',

    'vendor/ol.js',
    'vendor/ol.css',

    '.nojekyll',
];

const problems = [];

for (const file of requiredFiles) {
    try {
        await access(file, constants.F_OK);

        const info = await stat(file);

        if (info.isFile() && info.size === 0 && file !== '.nojekyll') {
            problems.push(`${file} существует, но пустой.`);

            continue;
        }

        console.log(`OK: ${file}`);
    } catch {
        problems.push(`не найден обязательный файл ${file}`);
    }
}

const config = await readFile('src/config.js', 'utf8');

for (const match of config.matchAll(/'(PASTE_[A-Z_]+)'/g)) {
    problems.push(`в src/config.js не заполнено значение ${match[1]}.`);
}

if (problems.length) {
    problems.forEach((problem) => console.error(`FAIL: ${problem}`));

    process.exit(1);
}

console.log('Static deployment check passed.');
