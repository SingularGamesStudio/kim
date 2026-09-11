import { ADD_COMMENT_URL, COMMENTS } from '../config.js';
import { blockRange } from '../core/columns.js';
import { readRange } from '../core/sheets.js';
import { normalizeName } from '../core/format.js';
import { sleep } from '../core/dom.js';

/**
 * Комментарии тренировки живут в её блоке из 4 столбцов, строки идут подряд
 * с первой: имя, комментарий, голос, время отправки.
 */
const NAME = 0;
const TEXT = 1;
const CHOICE = 2;
const SENT_AT = 3;

const parseComment = (row) => ({
    name: String(row[NAME] ?? ''),
    text: String(row[TEXT] || '+'),
    choice: String(row[CHOICE] ?? ''),
    sentAt: String(row[SENT_AT] ?? ''),
});

/** Один запрос к Sheets API: только 4 столбца нужной тренировки. */
export async function listComments(key) {
    const rows = await readRange(
        COMMENTS.spreadsheetId,
        blockRange(COMMENTS.sheet, key),
    );

    return rows.filter((row) => String(row[NAME] ?? '').trim()).map(parseComment);
}

/**
 * Единственный вызов Apps Script в проекте.
 *
 * Sheets API не поддерживает анонимную запись, поэтому добавление комментария
 * идёт через маленький скрипт. Запрос отправляется без чтения ответа
 * (mode: 'no-cors'), то есть без preflight и без ожидания cold start —
 * страница сразу рисует комментарий оптимистично, а факт записи
 * подтверждается перечитыванием блока.
 */
export function submitComment({ key, name, text, choice }) {
    const body = new URLSearchParams({ key, name, comment: text, choice });

    return fetch(ADD_COMMENT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body,
    });
}

/**
 * Ждёт, пока отправленный комментарий появится в таблице.
 * Интервалы растут, чтобы не тратить запросы впустую.
 */
export async function waitForComment(key, name, text, delays = [1200, 2000, 4000]) {
    for (const delay of delays) {
        await sleep(delay);

        const comments = await listComments(key);

        const saved = comments.some(
            (comment) =>
                normalizeName(comment.name) === normalizeName(name) &&
                comment.text === (text || '+'),
        );

        if (saved) {
            return comments;
        }
    }

    throw new Error('Комментарий не появился в таблице.');
}
