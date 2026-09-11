import { TIME_ZONE } from '../config.js';

const dateFormatter = (options) =>
    new Intl.DateTimeFormat('ru-RU', { timeZone: TIME_ZONE, ...options });

/** Дата в таблице хранится строкой 'YYYY-MM-DD'; полдень убирает сдвиг часового пояса. */
const atNoon = (isoDate) => new Date(`${isoDate}T12:00:00+03:00`);

/** «пятница, 18 сентября 2026 г.» */
export function fullDate(isoDate) {
    return dateFormatter({
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(atNoon(isoDate));
}

/** «пт, 18 сент. · 20:00» — для карточек на главной. */
export function shortDate(isoDate, time) {
    const date = atNoon(isoDate);

    const weekday = dateFormatter({ weekday: 'short' }).format(date);
    const dayMonth = dateFormatter({ day: 'numeric', month: 'short' }).format(date);

    return `${weekday}, ${dayMonth} · ${time}`;
}

/** «11.09, 20:34» — время комментария. */
export function commentTime(isoTimestamp) {
    const date = new Date(isoTimestamp);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return dateFormatter({
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

const WEEKDAYS_ACCUSATIVE = [
    ['в', 'воскресенье'],
    ['в', 'понедельник'],
    ['во', 'вторник'],
    ['в', 'среду'],
    ['в', 'четверг'],
    ['в', 'пятницу'],
    ['в', 'субботу'],
];

/** «в пятницу, 18 сентября» — для текста анонса. */
export function announcementDate(isoDate) {
    const date = atNoon(isoDate);
    const [preposition, weekday] = WEEKDAYS_ACCUSATIVE[date.getDay()];

    const dayMonth = dateFormatter({
        day: 'numeric',
        month: 'long',
    }).format(date);

    return `${preposition} ${weekday}, ${dayMonth}`;
}

/** 'YYYY-MM-DD' ближайшей пятницы — значение по умолчанию в форме. */
export function nearestFriday() {
    const date = new Date();

    date.setDate(date.getDate() + ((5 - date.getDay() + 7) % 7));

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

/** 'YYYY-MM-DDTHH:00' в московском времени — ключ часа в прогнозе Open-Meteo. */
export function moscowHourKey(date) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
    })
        .formatToParts(date)
        .filter((part) => part.type !== 'literal');

    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${value.year}-${value.month}-${value.day}T${value.hour}:00`;
}

/** '20:00' + 30 → '20:30'. */
export function addMinutes(time, minutesToAdd) {
    const [hours, minutes] = time.split(':').map(Number);
    const total = hours * 60 + minutes + minutesToAdd;

    return [
        String(Math.floor(total / 60) % 24).padStart(2, '0'),
        String(total % 60).padStart(2, '0'),
    ].join(':');
}

/** «1 участник / 2 участника / 5 участников». */
export function plural(count, one, few, many) {
    const mod100 = count % 100;
    const mod10 = count % 10;

    if (mod100 >= 11 && mod100 <= 14) {
        return many;
    }

    if (mod10 === 1) {
        return one;
    }

    return mod10 >= 2 && mod10 <= 4 ? few : many;
}

const isEight = (place) =>
    ['8ка', '8-ка', 'восьмерка'].includes(
        String(place ?? '').trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е'),
    );

/** Форма места после «у»: «у восьмерки», «у КПМ». */
export const placeAt = (place) => (isEight(place) ? 'восьмерки' : place);

/** Форма места после «к»: «к восьмерке», «к КПМ». */
export const placeTo = (place) => (isEight(place) ? 'восьмерке' : place);

/** Приведение имени к виду, по которому склеиваются комментарии одного человека. */
export const normalizeName = (name) =>
    String(name ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
