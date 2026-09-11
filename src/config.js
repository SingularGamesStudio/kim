/**
 * Единственный файл с настройками. Здесь нет и не должно быть секретов:
 * OAuth Client ID и Sheets API key — публичные идентификаторы SPA.
 *
 * API key обязательно ограничьте в Google Cloud Console:
 *   API restrictions      → только Google Sheets API
 *   Application restrictions → HTTP referrers → https://<user>.github.io/kim/*
 */
export const GOOGLE_CLIENT_ID =
    '577883504204-rtbbudqqdga003qh59i52t4fr4gkk6qs.apps.googleusercontent.com';

/** Публичный API key для анонимного чтения обеих таблиц. */
export const SHEETS_API_KEY = 'AIzaSyCbJU8PpdOVXxt4MpbnImm-wvhc_FXKHJQ';

/** Таблица с тренировками: чтение — публичное, запись — только админ (OAuth). */
export const TRAININGS = {
    spreadsheetId: '1CricNZuDzfAEx4CQNh3BFMgkdZ8X3ZnKinqfccM3m00',
    sheet: 'Trainings',
};

/** Таблица с комментариями: чтение — публичное, запись — через Apps Script. */
export const COMMENTS = {
    spreadsheetId: '12esXl0g1E9qbqZaW8QvYiDApNwjzppZJqaGJNmsH8fA',
    sheet: 'Signups',
};

/**
 * Единственный оставшийся вызов Apps Script: добавление комментария.
 * Sheets API не умеет анонимную запись даже в публично редактируемую таблицу.
 */
export const ADD_COMMENT_URL =
    'https://script.google.com/macros/s/AKfycbwFjUKTwAvlOz5lMopLD2jdn4xD3lVpAhJt0Ij8ADPhonExBnwU9OTUFxONxIosJrp8dw/exec';

export const BASE_URL = 'https://singulargamesstudio.github.io/kim/';

export const SAFETY_URL =
    'https://m.vk.ru/@kimmipt-kratkaya-instrukciya-po-tehnike-bezopasnosti-dlya-zanyatii-p';

export const TIME_ZONE = 'Europe/Moscow';

/** Пресеты мест. Ключ — это то, что попадает в <select> и в таблицу. */
export const LOCATIONS = {
    '8ка': { name: '8ка', lat: 55.928188, lng: 37.523233 },
    'КПМ': { name: 'КПМ', lat: 55.929108, lng: 37.521375 },
    'Обезьянник': { name: 'Обезьянник', lat: 55.930280, lng: 37.523853 },
};

/** Какие пресеты предлагаются для точки сбора и для места тренировки. */
export const LOCATION_PRESETS = {
    deployment: ['8ка', 'КПМ'],
    venue: ['Обезьянник'],
};

/** Центр карты в редакторе тренировки. */
export const MAP_CENTER = { lat: 55.9297, lng: 37.5215 };

export const TRAINING_TYPES = [
    'Мягкая строевая',
    'Мягкая Дуэльная',
    'Твёрдая Дуэльная',
    'Крафт',
];

/** Дополнительный вариант голосования «мне всё равно». */
export const NEUTRAL_VOTE = 'Тык';

/** Сколько тренировок показывать на главной. */
export const LIST_LIMIT = 30;
