import { TIME_ZONE } from '../config.js';
import { moscowHourKey } from '../core/format.js';
import { sleep } from '../core/dom.js';

/** Open-Meteo даёт прогноз максимум на 16 суток вперёд. */
const HORIZON_MS = 16 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 9000;
const HOURLY_FIELDS = [
    'temperature_2m',
    'precipitation_probability',
    'precipitation',
    'weather_code',
    'wind_speed_10m',
    'wind_gusts_10m',
];

/** Смотрим окно ±2 часа: осадки легко сдвигаются, а люди приходят заранее. */
const HOUR_OFFSETS = [-2, -1, 0, 1, 2];

const PENDING = 'Прогноз погоды уточняется.';

/** Коды WMO по типам осадков, в порядке убывания серьёзности. */
const PRECIPITATION_BY_CODE = [
    [[95, 96, 99], 'гроза'],
    [[75, 86], 'метель'],
    [[71, 73, 77, 85], 'снег'],
    [[56, 57, 66, 67], 'ледяной дождь'],
    [[65, 82], 'сильный дождь'],
    [[53, 55, 63, 80, 81], 'дождь'],
    [[51, 61], 'небольшой дождь'],
];

/** Скорости в км/ч — единицы Open-Meteo по умолчанию. */
const WIND_LEVELS = [
    [45, 65, 'очень сильный ветер'],
    [30, 45, 'сильный ветер'],
    [20, 35, 'ветрено'],
];

const sum = (values) => values.reduce((total, value) => total + value, 0);
const average = (values) => (values.length ? sum(values) / values.length : 0);

function forecastUrl({ lat, lng }) {
    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        hourly: HOURLY_FIELDS.join(','),
        timezone: TIME_ZONE,
        forecast_days: '16',
    });

    return `https://api.open-meteo.com/v1/forecast?${params}`;
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Open-Meteo HTTP ${response.status}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function precipitationText(codes, maxProbability, totalAmount, meanTemperature) {
    const present = new Set(codes);

    const matched = PRECIPITATION_BY_CODE.find(([group]) =>
        group.some((code) => present.has(code)),
    );

    if (matched) {
        return matched[1];
    }

    /*
     * weather_code иногда неинформативен, хотя вероятность и количество
     * осадков уже ненулевые. Температура различает дождь и снег.
     */
    if (maxProbability >= 70 || totalAmount >= 3) {
        return meanTemperature <= 1 ? 'снег' : 'дождь';
    }

    if (maxProbability >= 35 || totalAmount >= 0.2) {
        return meanTemperature <= 1 ? 'небольшой снег' : 'небольшой дождь';
    }

    return '';
}

function windDescription(maxSpeed, maxGust) {
    const level = WIND_LEVELS.find(
        ([speed, gust]) => maxSpeed >= speed || maxGust >= gust,
    );

    return level ? level[2] : '';
}

function describe(data, start) {
    const hourly = data?.hourly;

    if (!hourly?.time || HOURLY_FIELDS.some((field) => !hourly[field])) {
        return '';
    }

    const indexes = HOUR_OFFSETS.map((offset) =>
        hourly.time.indexOf(
            moscowHourKey(new Date(start.getTime() + offset * 3_600_000)),
        ),
    ).filter((index) => index >= 0);

    if (!indexes.length) {
        return '';
    }

    const at = (field) => indexes.map((index) => Number(hourly[field][index]));

    const temperatures = at('temperature_2m');
    const meanTemperature = average(temperatures);
    const temperature = Math.round(meanTemperature);

    const parts = [`${temperature > 0 ? '+' : ''}${temperature}°C`];

    const precipitation = precipitationText(
        at('weather_code'),
        Math.max(...at('precipitation_probability')),
        sum(at('precipitation')),
        meanTemperature,
    );

    const wind = windDescription(
        Math.max(...at('wind_speed_10m')),
        Math.max(...at('wind_gusts_10m')),
    );

    return `Прогноз: ${[parts, precipitation, wind].flat().filter(Boolean).join(', ')}.`;
}

/**
 * Возвращает { ok, text, reason }. При любой неудаче text остаётся
 * нейтральным: в анонс попадёт «Прогноз погоды уточняется».
 */
export async function fetchForecast({ date, time, venue }) {
    const start = new Date(`${date}T${time}:00+03:00`);

    if (start.getTime() - Date.now() > HORIZON_MS) {
        return {
            ok: false,
            text: PENDING,
            reason: 'Дата тренировки дальше 16-дневного горизонта прогноза.',
        };
    }

    const url = forecastUrl(venue);
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            const text = describe(await fetchJson(url), start);

            if (!text) {
                throw new Error('В прогнозе нет данных на нужное время.');
            }

            return { ok: true, text, reason: '' };
        } catch (error) {
            lastError = error;

            console.warn(`Прогноз, попытка ${attempt}:`, error);

            if (attempt < 2) {
                await sleep(900);
            }
        }
    }

    return {
        ok: false,
        text: PENDING,
        reason: lastError?.message ?? 'Неизвестная ошибка при запросе прогноза.',
    };
}
