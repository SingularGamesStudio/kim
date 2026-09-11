/**
 * Адресация комментариев по столбцам вместо UUID.
 *
 * Каждой тренировке принадлежит блок из 4 столбцов в таблице комментариев:
 *   +0 имя, +1 комментарий, +2 голос, +3 время отправки (ISO).
 *
 * Блоки идут с шагом 4, поэтому ID тренировки — буква первого столбца блока:
 *   блок 0 → A, блок 1 → E, блок 2 → I, ... блок 6 → Y, блок 7 → AC.
 *
 * Такой ID короче UUID, читается в самой таблице и позволяет прочитать
 * комментарии одной тренировки одним запросом к диапазону из 4 столбцов.
 */

export const BLOCK_WIDTH = 4;

/** 1 → 'A', 27 → 'AA'. */
export function columnLetter(index) {
    let rest = index;
    let letters = '';

    while (rest > 0) {
        const remainder = (rest - 1) % 26;

        letters = String.fromCharCode(65 + remainder) + letters;
        rest = Math.floor((rest - 1) / 26);
    }

    return letters;
}

/** 'A' → 1, 'AA' → 27. */
export function columnIndex(letters) {
    return [...letters.toUpperCase()].reduce(
        (total, letter) => total * 26 + (letter.charCodeAt(0) - 64),
        0,
    );
}

/** Номер блока (0, 1, 2, …) → ID тренировки ('A', 'E', 'I', …). */
export function blockKey(blockNumber) {
    return columnLetter(blockNumber * BLOCK_WIDTH + 1);
}

/** ID тренировки → номер блока, либо null, если ID некорректный. */
export function blockNumber(key) {
    if (!/^[A-Z]{1,3}$/.test(key ?? '')) {
        return null;
    }

    const offset = columnIndex(key) - 1;

    return offset % BLOCK_WIDTH === 0 ? offset / BLOCK_WIDTH : null;
}

export const isValidKey = (key) => blockNumber(key) !== null;

/** Диапазон блока: 'Comments!E1:H'. */
export function blockRange(sheet, key) {
    const start = columnIndex(key);
    const end = columnLetter(start + BLOCK_WIDTH - 1);

    return `${sheet}!${key}1:${end}`;
}
