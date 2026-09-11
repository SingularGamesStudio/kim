/**
 * Единственная задача этого скрипта — принять комментарий от анонимного
 * посетителя и дописать его в публичную таблицу.
 *
 * Всё чтение вынесено на клиент: страницы обращаются к Google Sheets API
 * напрямую с публичным API-ключом, поэтому здесь нет ни doGet, ни JSONP,
 * ни кэша. Причина, по которой запись нельзя сделать так же: Sheets API
 * не принимает анонимные изменения даже у таблицы, открытой на запись —
 * API-ключ даёт только чтение.
 *
 * Деплой: Execute as = Me, Who has access = Anyone.
 */

/** Ширина блока столбцов, отведённого одной тренировке. */
var BLOCK_WIDTH = 4;

var SHEET_NAME = 'Signups';

var LIMITS = { name: 80, comment: 500, choice: 60 };

/** Столбцы, с которых Sheets начинает считать содержимое формулой. */
var FORMULA_PREFIXES = ['=', '+', '-', '@'];

function json(payload) {
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
        ContentService.MimeType.JSON
    );
}

/** 'A' -> 1, 'AA' -> 27. Возвращает 0 для мусора. */
function columnIndex(letters) {
    if (!/^[A-Z]{1,3}$/.test(letters)) {
        return 0;
    }

    var index = 0;

    for (var i = 0; i < letters.length; i += 1) {
        index = index * 26 + (letters.charCodeAt(i) - 64);
    }

    return index;
}

/**
 * Ключ тренировки — буква первого столбца её блока, поэтому допустимы
 * только столбцы A, E, I, M, Q… Это отсекает попытки писать в середину блока.
 */
function keyToColumn(key) {
    var index = columnIndex(String(key || '').trim().toUpperCase());

    return index > 0 && (index - 1) % BLOCK_WIDTH === 0 ? index : 0;
}

function clean(value, limit) {
    var text = String(value == null ? '' : value)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .trim()
        .slice(0, limit);

    // Защита от того, чтобы введённый текст стал формулой в таблице.
    return FORMULA_PREFIXES.indexOf(text.charAt(0)) === -1 ? text : "'" + text;
}

/** Первая строка блока, где ещё нет имени. */
function firstEmptyRow(sheet, column) {
    var lastRow = sheet.getLastRow();

    if (lastRow < 1) {
        return 1;
    }

    var names = sheet.getRange(1, column, lastRow, 1).getValues();

    for (var row = 0; row < names.length; row += 1) {
        if (String(names[row][0]).trim() === '') {
            return row + 1;
        }
    }

    return lastRow + 1;
}

function doPost(e) {
    var params = (e && e.parameter) || {};

    // Ловушка для ботов: у людей это поле скрыто и всегда пустое.
    if (String(params.website || '').trim() !== '') {
        return json({ ok: true, skipped: 'honeypot' });
    }

    var column = keyToColumn(params.key);
    var name = clean(params.name, LIMITS.name);

    if (!column) {
        return json({ ok: false, error: 'bad_key' });
    }

    if (!name) {
        return json({ ok: false, error: 'empty_name' });
    }

    var row = [
        name,
        clean(params.comment, LIMITS.comment) || '+',
        clean(params.choice, LIMITS.choice),
        new Date().toISOString()
    ];

    var lock = LockService.getScriptLock();

    if (!lock.tryLock(20000)) {
        return json({ ok: false, error: 'busy' });
    }

    try {
        var sheet =
            SpreadsheetApp.openById(getProperty_("SIGNUPS_SHEET_ID")).getSheetByName(SHEET_NAME);

        if (!sheet) {
            return json({ ok: false, error: 'no_sheet' });
        }

        var target = firstEmptyRow(sheet, column);

        // Лист может быть короче нужной строки — тогда добавляем строки.
        if (target > sheet.getMaxRows()) {
            sheet.insertRowsAfter(sheet.getMaxRows(), target - sheet.getMaxRows());
        }

        sheet.getRange(target, column, 1, BLOCK_WIDTH).setValues([row]);

        SpreadsheetApp.flush();

        return json({ ok: true, row: target });
    } catch (error) {
        return json({ ok: false, error: String(error) });
    } finally {
        lock.releaseLock();
    }
}

function getProperty_(key) {
    const value = PropertiesService
        .getScriptProperties()
        .getProperty(key);

    if (!value) {
        throw new Error(
            `Не задано Script Property: ${key}`
        );
    }

    return value;
}