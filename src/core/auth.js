import { GOOGLE_CLIENT_ID } from '../config.js';
import { sleep } from './dom.js';

/**
 * OAuth нужен ровно одному человеку — админу, который создаёт тренировку.
 * Все публичные чтения идут по API key и этот модуль не задействуют.
 */
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_KEY = 'kimAccessToken';
const EXPIRES_KEY = 'kimAccessTokenExpiresAt';

/** Запас, чтобы не уйти в запрос с токеном, который истечёт по дороге. */
const SAFETY_MARGIN_MS = 60_000;

export function storedToken() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiresAt = Number(sessionStorage.getItem(EXPIRES_KEY));

    if (!token || !expiresAt || Date.now() >= expiresAt - SAFETY_MARGIN_MS) {
        clearToken();

        return null;
    }

    return token;
}

export function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRES_KEY);
}

async function waitForGoogleIdentityServices() {
    const deadline = Date.now() + 10_000;

    while (!window.google?.accounts?.oauth2) {
        if (Date.now() > deadline) {
            throw new Error('Google Identity Services не загрузился за 10 секунд.');
        }

        await sleep(50);
    }
}

/**
 * Открывает popup выбора аккаунта. Вызывать только из обработчика клика,
 * иначе браузер заблокирует окно.
 */
export async function requestToken() {
    const cached = storedToken();

    if (cached) {
        return cached;
    }

    await waitForGoogleIdentityServices();

    return new Promise((resolve, reject) => {
        window.google.accounts.oauth2
            .initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPE,
                prompt: 'select_account',
                callback: (response) => {
                    if (response.error || !response.access_token) {
                        reject(
                            new Error(
                                response.error_description ||
                                    response.error ||
                                    'Google не вернул access token.',
                            ),
                        );

                        return;
                    }

                    const expiresAt =
                        Date.now() + Number(response.expires_in || 3600) * 1000;

                    sessionStorage.setItem(TOKEN_KEY, response.access_token);
                    sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));

                    resolve(response.access_token);
                },
            })
            .requestAccessToken();
    });
}
