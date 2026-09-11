import { SHEETS_API_KEY } from '../config.js';
import { clearToken } from './auth.js';

/**
 * Тонкая обёртка над Google Sheets API v4.
 *
 * Чтение — анонимное, по API key: публичная таблица отдаётся напрямую с
 * серверов Google, без прослойки Apps Script и без cold start.
 * Запись — только с OAuth-токеном админа: анонимная запись через Sheets API
 * невозможна даже в публично редактируемую таблицу.
 */
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * UNFORMATTED_VALUE обязателен: FORMATTED_VALUE вернул бы координаты
 * в локали таблицы («55,928» вместо «55.928»).
 */
const RENDER = 'UNFORMATTED_VALUE';

async function request(url, options = {}, token = null) {
    const response = await fetch(url, {
        ...options,
        headers: token
            ? {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
              }
            : undefined,
    });

    if (response.status === 401 && token) {
        clearToken();
    }

    if (!response.ok) {
        throw new Error(
            `Google Sheets HTTP ${response.status}: ${await response.text()}`,
        );
    }

    return response.json();
}

/** Один диапазон — один запрос. Возвращает массив строк (может быть пустым). */
export async function readRange(spreadsheetId, range, token = null) {
    const url = new URL(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`);

    url.searchParams.set('majorDimension', 'ROWS');
    url.searchParams.set('valueRenderOption', RENDER);

    if (!token) {
        url.searchParams.set('key', SHEETS_API_KEY);
    }

    const data = await request(url, {}, token);

    return data.values ?? [];
}

/**
 * Несколько диапазонов одной таблицы — тоже один запрос.
 * Диапазоны из разных таблиц объединить нельзя: это ограничение API.
 */
export async function readRanges(spreadsheetId, ranges, token = null) {
    const url = new URL(`${BASE}/${spreadsheetId}/values:batchGet`);

    ranges.forEach((range) => url.searchParams.append('ranges', range));
    url.searchParams.set('majorDimension', 'ROWS');
    url.searchParams.set('valueRenderOption', RENDER);

    if (!token) {
        url.searchParams.set('key', SHEETS_API_KEY);
    }

    const data = await request(url, {}, token);

    return (data.valueRanges ?? []).map((entry) => entry.values ?? []);
}

/** Добавляет строку в конец листа. Возвращает диапазон, куда она попала. */
export async function appendRow(spreadsheetId, range, values, token) {
    const url = new URL(
        `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append`,
    );

    url.searchParams.set('valueInputOption', 'RAW');
    url.searchParams.set('insertDataOption', 'INSERT_ROWS');

    const data = await request(
        url,
        { method: 'POST', body: JSON.stringify({ values: [values] }) },
        token,
    );

    return data.updates?.updatedRange ?? '';
}

/**
 * Sheets отдаёт дату, введённую руками в таблице, как серийный номер.
 * Приводим её к 'YYYY-MM-DD', чтобы остальной код видел только строки.
 */
export function toIsoDate(value) {
    if (typeof value !== 'number') {
        return String(value ?? '');
    }

    // Точка отсчёта Google Sheets — 30.12.1899.
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);

    return date.toISOString().slice(0, 10);
}
