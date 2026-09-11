import { LIST_LIMIT, TRAININGS } from '../config.js';
import { blockKey, isValidKey, blockNumber } from '../core/columns.js';
import { appendRow, readRange, toIsoDate } from '../core/sheets.js';

/**
 * Лист Trainings, строка 1 — заголовки:
 * A key, B createdAt, C date, D time, E typesJson, F comment,
 * G deploymentName, H deploymentLat, I deploymentLng,
 * J venueName, K venueLat, L venueLng, M quorum, N weather.
 */
const ALL_ROWS = `${TRAININGS.sheet}!A2:N`;
const KEY_COLUMN = `${TRAININGS.sheet}!A2:A`;
const FIRST_DATA_ROW = 2;

const CACHE_KEY = 'kimTrainingRows';
const FRESH_MS = 120_000;

function readCache() {
    try {
        const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null');

        return Array.isArray(cached?.rows) ? cached : null;
    } catch {
        return null;
    }
}

function writeCache(rows) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows }));
    } catch {
        // Приватный режим браузера может запрещать запись — это не ошибка.
    }
}

/**
 * Виды тренировки хранятся в ячейке как JSON.
 * Ручная правка этой ячейки не должна ломать страницу.
 */
function parseTypes(value) {
    try {
        const types = JSON.parse(String(value || '[]'));

        return Array.isArray(types) ? types.map(String) : [];
    } catch {
        return String(value)
            .split(/\s*[,;\/]\s*/)
            .filter(Boolean);
    }
}

function parseTraining(row) {
    return {
        key: String(row[0] ?? ''),
        createdAt: String(row[1] ?? ''),
        date: toIsoDate(row[2]),
        time: String(row[3] ?? ''),
        types: parseTypes(row[4]),
        comment: String(row[5] ?? ''),
        deployment: {
            name: String(row[6] ?? ''),
            lat: Number(row[7]),
            lng: Number(row[8]),
        },
        venue: {
            name: String(row[9] ?? ''),
            lat: Number(row[10]),
            lng: Number(row[11]),
        },
        quorum: Number(row[12]),
        weather: String(row[13] ?? ''),
    };
}

function serializeTraining(training) {
    return [
        training.key,
        training.createdAt,
        training.date,
        training.time,
        JSON.stringify(training.types),
        training.comment,
        training.deployment.name,
        training.deployment.lat,
        training.deployment.lng,
        training.venue.name,
        training.venue.lat,
        training.venue.lng,
        training.quorum,
        training.weather ?? '',
    ];
}

const byDateDesc = (a, b) =>
    b.date.localeCompare(a.date) || b.time.localeCompare(a.time);

function toList(rows) {
    return rows
        .filter((row) => isValidKey(String(row[0] ?? '')))
        .map(parseTraining)
        .sort(byDateDesc)
        .slice(0, LIST_LIMIT);
}

/**
 * Список тренировок: один запрос к Sheets API.
 *
 * Если в sessionStorage есть данные, они отдаются мгновенно, а свежая версия
 * подгружается в фоне и приходит в onFresh — страница не ждёт сеть.
 */
export function listTrainings({ onFresh } = {}) {
    const cached = readCache();

    const fetchFresh = readRange(TRAININGS.spreadsheetId, ALL_ROWS).then((rows) => {
        writeCache(rows);

        return toList(rows);
    });

    if (!cached) {
        return fetchFresh;
    }

    if (Date.now() - cached.at > FRESH_MS && onFresh) {
        fetchFresh.then(onFresh).catch((error) => console.warn(error));
    }

    return Promise.resolve(toList(cached.rows));
}

/**
 * Одна тренировка по её ID (буква первого столбца блока комментариев).
 *
 * Быстрый путь: тренировка из блока N лежит в строке N+2, поэтому читаем
 * ровно одну строку. Если ID в ней не совпал (строку удаляли или переносили),
 * дочитываем лист целиком. Оба пути — не больше одного запроса каждый.
 */
export async function getTraining(key) {
    if (!isValidKey(key)) {
        throw new Error('Некорректный ID тренировки.');
    }

    const cachedRow = readCache()?.rows.find((row) => String(row[0] ?? '') === key);

    if (cachedRow) {
        return parseTraining(cachedRow);
    }

    const expectedRow = blockNumber(key) + FIRST_DATA_ROW;
    const range = `${TRAININGS.sheet}!A${expectedRow}:N${expectedRow}`;

    const [directRow] = await readRange(TRAININGS.spreadsheetId, range);

    if (String(directRow?.[0] ?? '') === key) {
        return parseTraining(directRow);
    }

    const rows = await readRange(TRAININGS.spreadsheetId, ALL_ROWS);

    writeCache(rows);

    const row = rows.find((current) => String(current[0] ?? '') === key);

    if (!row) {
        throw new Error('Тренировка не найдена.');
    }

    return parseTraining(row);
}

/**
 * Проверка прав админа: чтение одной ячейки с OAuth-токеном.
 * Если у аккаунта нет доступа к таблице, Google вернёт 403.
 */
export function verifyAdminAccess(token) {
    return readRange(TRAININGS.spreadsheetId, `${TRAININGS.sheet}!A1:A1`, token);
}

/**
 * Создание тренировки: два запроса с токеном админа — актуальное
 * число строк (из него считается номер блока) и сама запись.
 */
export async function createTraining(draft, token) {
    const keys = await readRange(TRAININGS.spreadsheetId, KEY_COLUMN, token);

    const training = { ...draft, key: blockKey(keys.length) };

    await appendRow(
        TRAININGS.spreadsheetId,
        `${TRAININGS.sheet}!A:N`,
        serializeTraining(training),
        token,
    );

    sessionStorage.removeItem(CACHE_KEY);

    return training;
}
