const C = window.APP_CONFIG;

const SHEETS_SCOPE =
    "https://www.googleapis.com/auth/spreadsheets";

const TOKEN_STORAGE_KEY =
    "fencingTrainingGoogleAccessToken";

const TOKEN_EXPIRES_AT_STORAGE_KEY =
    "fencingTrainingGoogleAccessTokenExpiresAt";

let accessToken = null;

accessToken = getStoredAccessToken();

function esc(value) {
    const element = document.createElement("span");

    element.textContent = String(value ?? "");

    return element.innerHTML;
}

function sleep(milliseconds) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

function getStoredAccessToken() {
    const token = sessionStorage.getItem(
        TOKEN_STORAGE_KEY
    );

    const expiresAt = Number(
        sessionStorage.getItem(
            TOKEN_EXPIRES_AT_STORAGE_KEY
        )
    );

    // Добавлен запас 60 секунд: не используем token,
    // который почти истёк.
    const safetyMarginMs = 60 * 1000;

    if (
        !token ||
        !expiresAt ||
        Date.now() >= expiresAt - safetyMarginMs
    ) {
        clearStoredAccessToken();

        return null;
    }

    return token;
}

function storeAccessToken(tokenResponse) {
    const expiresInSeconds = Number(
        tokenResponse.expires_in || 3600
    );

    const expiresAt =
        Date.now() + expiresInSeconds * 1000;

    accessToken = tokenResponse.access_token;

    sessionStorage.setItem(
        TOKEN_STORAGE_KEY,
        accessToken
    );

    sessionStorage.setItem(
        TOKEN_EXPIRES_AT_STORAGE_KEY,
        String(expiresAt)
    );
}

function clearStoredAccessToken() {
    accessToken = null;

    sessionStorage.removeItem(TOKEN_STORAGE_KEY);

    sessionStorage.removeItem(
        TOKEN_EXPIRES_AT_STORAGE_KEY
    );
}

async function waitForGoogleIdentityServices() {
    const timeoutMs = 10_000;
    const intervalMs = 50;
    const startedAt = Date.now();

    while (!window.google?.accounts?.oauth2) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(
                "Google Identity Services не загрузился за 10 секунд."
            );
        }

        await sleep(intervalMs);
    }
}

async function googleToken() {
    const cachedToken = getStoredAccessToken();

    if (cachedToken) {
        accessToken = cachedToken;

        return accessToken;
    }

    await waitForGoogleIdentityServices();

    return new Promise((resolve, reject) => {
        const tokenClient =
            google.accounts.oauth2.initTokenClient({
                client_id: C.GOOGLE_CLIENT_ID,
                scope: SHEETS_SCOPE,
                prompt: "select_account",

                callback: (response) => {
                    if (response.error) {
                        reject(
                            new Error(
                                response.error_description ||
                                response.error
                            )
                        );

                        return;
                    }

                    if (!response.access_token) {
                        reject(
                            new Error(
                                "Google не вернул access token."
                            )
                        );

                        return;
                    }

                    storeAccessToken(response);

                    resolve(accessToken);
                }
            });

        // Этот вызов должен происходить непосредственно
        // из click handler кнопки «Войти через Google».
        tokenClient.requestAccessToken();
    });
}

async function sheets(path, options = {}) {
    const token = await googleToken();

    const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${C.PRIVATE_SPREADSHEET_ID}/${path}`,
        {
            ...options,

            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        }
    );

    // Если access token инвалидирован или истёк между
    // получением и запросом — не используем его дальше.
    if (response.status === 401) {
        clearStoredAccessToken();
    }

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            errorText || `Google Sheets HTTP ${response.status}`
        );
    }

    return response.json();
}

async function requireAdmin() {
    // Реальная проверка прав:
    // если аккаунт не имеет доступа к PRIVATE_SPREADSHEET_ID,
    // Google Sheets вернёт 403.
    await sheets("?fields=properties.title");
}

async function getAdminTrainings() {
    const response = await sheets(
        "values/Trainings!A2:N?majorDimension=ROWS"
    );

    return (response.values || []).map(rowToTraining);
}

async function appendTraining(training) {
    const row = [
        training.id,
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
        training.weather || ""
    ];

    const range = encodeURIComponent("Trainings!A:N");

    await sheets(
        `values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
            method: "POST",

            body: JSON.stringify({
                values: [row]
            })
        }
    );
}

function rowToTraining(row) {
    return {
        id: row[0],
        createdAt: row[1],
        date: row[2],
        time: row[3],
        types: JSON.parse(row[4] || "[]"),
        comment: row[5] || "",

        deployment: {
            name: row[6],
            lat: Number(row[7]),
            lng: Number(row[8])
        },

        venue: {
            name: row[9],
            lat: Number(row[10]),
            lng: Number(row[11])
        },

        quorum: Number(row[12]),
        weather: row[13] || ""
    };
}

async function publicGetWithRetry(payload) {
    const delaysMs = [0, 1000];

    let lastError = null;

    for (const delayMs of delaysMs) {
        if (delayMs) {
            await sleep(delayMs);
        }

        try {
            return await publicGet(payload);
        } catch (error) {
            lastError = error;

            console.warn(
                "Apps Script JSONP attempt failed:",
                error
            );
        }
    }

    throw lastError || new Error(
        "Apps Script недоступен."
    );
}

function publicGet(payload) {
    return new Promise((resolve, reject) => {
        const callbackName =
            `fencingJsonp_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2)}`;

        const timeoutMs = 45_000;

        const script = document.createElement("script");

        const url = new URL(C.APPS_SCRIPT_URL);

        Object.entries(payload).forEach(
            ([key, value]) => {
                url.searchParams.set(
                    key,
                    String(value ?? "")
                );
            }
        );

        url.searchParams.set(
            "callback",
            callbackName
        );

        const timeoutId = window.setTimeout(() => {
            cleanup();

            reject(
                new Error(
                    "Apps Script не ответил за 15 секунд."
                )
            );
        }, timeoutMs);

        window[callbackName] = (data) => {
            cleanup();

            if (!data?.ok) {
                reject(
                    new Error(
                        data?.error ||
                        "Apps Script вернул ошибку."
                    )
                );

                return;
            }

            resolve(data);
        };

        script.onerror = () => {
            cleanup();

            reject(
                new Error(
                    "Не удалось загрузить Apps Script JSONP."
                )
            );
        };

        function cleanup() {
            window.clearTimeout(timeoutId);

            delete window[callbackName];

            script.remove();
        }

        script.fetchPriority = "high";

        script.src = url.toString();

        document.head.appendChild(script);
    });
}

/*
 * Отправляет POST как обычную HTML form в скрытый iframe.
 *
 * CORS не мешает форме навигировать iframe на другой origin.
 * Мы намеренно не пытаемся прочитать response: затем training.js
 * заново получает данные через publicGet / JSONP.
 */
function publicPost(payload) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement("iframe");
        const form = document.createElement("form");

        const targetName =
            `fencingPostFrame_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2)}`;

        iframe.name = targetName;
        iframe.style.display = "none";

        form.method = "POST";
        form.action = C.APPS_SCRIPT_URL;
        form.target = targetName;
        form.style.display = "none";

        Object.entries(payload).forEach(
            ([key, value]) => {
                const input = document.createElement("input");

                input.type = "hidden";
                input.name = key;
                input.value = String(value ?? "");

                form.appendChild(input);
            }
        );

        document.body.appendChild(iframe);
        document.body.appendChild(form);

        try {
            form.submit();
        } catch (error) {
            iframe.remove();
            form.remove();

            reject(error);

            return;
        }

        // Нельзя читать cross-origin response iframe.
        // Небольшая задержка нужна, чтобы Apps Script успел
        // дописать строку в таблицу до последующего JSONP GET.
        window.setTimeout(() => {
            iframe.remove();
            form.remove();

            resolve({
                ok: true
            });
        }, 700);
    });
}

function fmtDate(isoDate) {
    return new Intl.DateTimeFormat("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Moscow"
    }).format(
        new Date(`${isoDate}T12:00:00+03:00`)
    );
}

function mapsUrl(location) {
    return (
        "https://www.openstreetmap.org/" +
        `?mlat=${location.lat}` +
        `&mlon=${location.lng}` +
        `#map=18/${location.lat}/${location.lng}`
    );
}