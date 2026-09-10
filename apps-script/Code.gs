const TRAINING_HEADERS = [
    "id",
    "createdAt",
    "date",
    "time",
    "typesJson",
    "comment",
    "deploymentName",
    "deploymentLat",
    "deploymentLng",
    "venueName",
    "venueLat",
    "venueLng",
    "quorum",
    "weather"
];

const SIGNUP_HEADERS = [
    "trainingId",
    "submittedAt",
    "name",
    "comment",
    "choice"
];

/*
 * GET используется для JSONP-чтения.
 *
 * Пример:
 * /exec?action=getTraining&id=<UUID>&callback=myCallback
 */
function doGet(event) {
    try {
        const query = event.parameter || {};

        const result = handleRequest_(query);

        return jsonpOutput_(result, query.callback);
    } catch (error) {
        console.error(error);

        return jsonpOutput_(
            {
                ok: false,
                error: String(error.message || error)
            },
            event.parameter?.callback
        );
    }
}

/*
 * POST приходит из HTML form, отправленной в скрытый iframe.
 * Это не fetch: следовательно, браузер не применяет CORS к ответу.
 */
function doPost(event) {
    try {
        const query = event.parameter || {};

        const result = handleRequest_(query);

        return jsonOutput_(result);
    } catch (error) {
        console.error(error);

        return jsonOutput_({
            ok: false,
            error: String(error.message || error)
        });
    }
}

function handleRequest_(query) {
    const action = String(query.action || "");

    if (action === "listTrainings") {
        return listTrainings_();
    }

    if (action === "getTraining") {
        return getTraining_(query);
    }

    if (action === "signup") {
        return signup_(query);
    }

    throw new Error(`Unknown action: ${action}`);
}

function listTrainings_() {
    const cacheKey = "public-training-list";

    const cached = getCacheJson_(cacheKey);

    if (cached) {
        return {
            ok: true,
            trainings: cached
        };
    }

    const trainingsSheet = getSheet_(
        getProperty_("TRAININGS_SHEET_ID"),
        "Trainings",
        TRAINING_HEADERS
    );

    const lastRow = trainingsSheet.getLastRow();

    if (lastRow < 2) {
        return {
            ok: true,
            trainings: []
        };
    }

    const rows = trainingsSheet
        .getRange(2, 1, lastRow - 1, 14)
        .getValues();

    /*
     * На главную отдаём только публичную сводку.
     * Полный комментарий, координаты и прочие детали
     * доступны только по конкретному UUID тренировки.
     */
    const trainings = rows
        .map((row) => {
            return {
                id: String(row[0]),
                date: formatSheetDate_(row[2]),
                time: String(row[3]),
                types: JSON.parse(String(row[4] || "[]")),

                venue: {
                    name: String(row[9] || "")
                },

                quorum: Number(row[12])
            };
        })
        .sort((a, b) => {
            const dateCompare =
                b.date.localeCompare(a.date);

            if (dateCompare !== 0) {
                return dateCompare;
            }

            return b.time.localeCompare(a.time);
        })
        .slice(0, 30);

    putCacheJson_(cacheKey, trainings, 121600);

    return {
        ok: true,
        trainings
    };
}

function getTraining_(query) {
    const trainingId = String(query.id || "");

    if (!isValidUuid_(trainingId)) {
        throw new Error("Некорректный ID тренировки.");
    }

    const trainingCacheKey =
        `training:${trainingId}`;

    const signupsCacheKey =
        `signups:${trainingId}`;

    let training = getCacheJson_(
        trainingCacheKey
    );

    if (!training) {
        const trainingsSheet = getSheet_(
            getProperty_("TRAININGS_SHEET_ID"),
            "Trainings",
            TRAINING_HEADERS
        );

        const lastRow = trainingsSheet.getLastRow();

        if (lastRow < 2) {
            throw new Error("Тренировка не найдена.");
        }

        const rows = trainingsSheet
            .getRange(2, 1, lastRow - 1, 14)
            .getValues();

        const row = rows.find((currentRow) => {
            return String(currentRow[0]) === trainingId;
        });

        if (!row) {
            throw new Error("Тренировка не найдена.");
        }

        training = {
            id: String(row[0]),
            createdAt: toIsoString_(row[1]),
            date: formatSheetDate_(row[2]),
            time: String(row[3]),
            types: JSON.parse(
                String(row[4] || "[]")
            ),
            comment: String(row[5] || ""),

            deployment: {
                name: String(row[6] || ""),
                lat: Number(row[7]),
                lng: Number(row[8])
            },

            venue: {
                name: String(row[9] || ""),
                lat: Number(row[10]),
                lng: Number(row[11])
            },

            quorum: Number(row[12]),
            weather: String(row[13] || "")
        };

        /*
         * Параметры тренировки после создания обычно не меняются.
         * Десять минут cache для них допустимы.
         */
        putCacheJson_(
            trainingCacheKey,
            training,
            121600
        );
    }

    let signups = getCacheJson_(
        signupsCacheKey
    );

    if (!signups) {
        const signupsSheet = getSheet_(
            getProperty_("SIGNUPS_SHEET_ID"),
            "Signups",
            SIGNUP_HEADERS
        );

        const lastRow = signupsSheet.getLastRow();

        if (lastRow < 2) {
            signups = [];
        } else {
            const rows = signupsSheet
                .getRange(2, 1, lastRow - 1, 5)
                .getValues();

            signups = rows
                .filter((currentRow) => {
                    return (
                        String(currentRow[0]) ===
                        trainingId
                    );
                })
                .map((currentRow) => {
                    return {
                        trainingId: String(currentRow[0]),
                        submittedAt: toIsoString_(
                            currentRow[1]
                        ),
                        name: String(
                            currentRow[2] || ""
                        ),
                        comment: String(
                            currentRow[3] || "+"
                        ),
                        choice: String(
                            currentRow[4] || ""
                        )
                    };
                });
        }

        /*
         * Комментарии обновляются часто, поэтому cache короткий.
         * После signup cache будет немедленно сброшен.
         */
        putCacheJson_(
            signupsCacheKey,
            signups,
            30
        );
    }

    return {
        ok: true,
        training,
        signups
    };
}

function signup_(query) {
    if (String(query.website || "").trim()) {
        return { ok: true };
    }

    const trainingId = String(query.trainingId || "");

    const name = String(query.name || "")
        .trim()
        .slice(0, 80);

    const comment = String(query.comment || "+")
        .trim()
        .slice(0, 500);

    const choice = String(query.choice || "")
        .trim()
        .slice(0, 80);

    if (!isValidUuid_(trainingId)) {
        throw new Error("Некорректный ID тренировки.");
    }

    if (!name) {
        throw new Error("Введите имя.");
    }

    const lock = LockService.getScriptLock();

    lock.waitLock(5000);

    try {
        const signupsSheet = getSheet_(
            getProperty_("SIGNUPS_SHEET_ID"),
            "Signups",
            SIGNUP_HEADERS
        );

        const nextRow = signupsSheet.getLastRow() + 1;

        /*
         * appendRow/setValues интерпретируют строки =, +, -, @
         * как формулы. Поэтому опасные начала строк получают
         * апостроф в хранимом значении.
         */
        signupsSheet
            .getRange(nextRow, 1, 1, 5)
            .setValues([[
                sheetText_(trainingId),
                new Date().toISOString(),
                sheetText_(name),
                sheetText_(comment || "+"),
                sheetText_(choice)
            ]]);

        removeCache_(`signups:${trainingId}`);
    } finally {
        lock.releaseLock();
    }

    return { ok: true };
}

function sheetText_(value) {
    const text = String(value ?? "");

    /*
     * Apostrophe не отображается пользователю в Google Sheets,
     * но заставляет Sheets хранить строку как текст.
     */
    if (/^[=+@-]/.test(text)) {
        return `'${text}`;
    }

    return text;
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

function getSheet_(spreadsheetId, sheetName, headers) {
    const spreadsheet =
        SpreadsheetApp.openById(spreadsheetId);

    let sheet =
        spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);

        sheet
            .getRange(1, 1, 1, headers.length)
            .setValues([headers]);

        sheet.setFrozenRows(1);
    }

    return sheet;
}

function getCache_() {
    return CacheService.getScriptCache();
}

function getCacheJson_(key) {
    const raw = getCache_().get(key);

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        getCache_().remove(key);

        return null;
    }
}

function putCacheJson_(key, value, seconds) {
    const serialized = JSON.stringify(value);

    if (serialized.length < 90000) {
        getCache_().put(
            key,
            serialized,
            seconds
        );
    }
}

function removeCache_(key) {
    getCache_().remove(key);
}

function jsonOutput_(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(
            ContentService.MimeType.JSON
        );
}

/*
 * JSONP — легальный обход отсутствия CORS для GET.
 *
 * callback строго валидируется, чтобы пользователь не мог
 * передать произвольный JavaScript вместо имени callback-функции.
 */
function jsonpOutput_(data, callback) {
    const safeCallback = String(callback || "");

    if (
        !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(
            safeCallback
        )
    ) {
        return jsonOutput_(data);
    }

    const source =
        `${safeCallback}(${JSON.stringify(data)});`;

    return ContentService
        .createTextOutput(source)
        .setMimeType(
            ContentService.MimeType.JAVASCRIPT
        );
}

function isValidUuid_(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(value);
}

function toIsoString_(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }

    return String(value || "");
}

function formatSheetDate_(value) {
    if (value instanceof Date) {
        return Utilities.formatDate(
            value,
            "Europe/Moscow",
            "yyyy-MM-dd"
        );
    }

    return String(value || "");
}