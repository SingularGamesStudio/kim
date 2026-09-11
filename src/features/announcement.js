import { addMinutes, announcementDate, placeAt, placeTo } from '../core/format.js';

/** Насколько позже начала ещё имеет смысл идти к точке сбора. */
const LATE_MINUTES = 30;

const TITLE_BY_TYPE = {
    'Мягкая Дуэльная': 'Дуэльная тренировка',
    'Твёрдая Дуэльная': 'Дуэльная тренировка',
    'Мягкая строевая': 'Тактическая тренировка',
    'Крафт': 'Крафт',
};

const DEFAULT_TITLE = 'Фехтовальная тренировка';

function title(types) {
    if (types.length !== 1) {
        return DEFAULT_TITLE;
    }

    return TITLE_BY_TYPE[types[0]] ?? DEFAULT_TITLE;
}

/** Готовый текст поста для VK и Telegram. */
export function announcementText(training, url) {
    const lateTime = addMinutes(training.time, LATE_MINUTES);

    const heading = [
        `${title(training.types)} ${announcementDate(training.date)}.`,
        training.types.length > 1 ? 'За формат голосуйте на сайте.' : '',
    ]
        .filter(Boolean)
        .join('\n');

    const details =
        `Начало в ${training.time} у ${placeAt(training.deployment.name)}, ` +
        `место тренировки — ${training.venue.name}. ` +
        `Даже если вы опаздываете до ${lateTime}, подходите сначала ` +
        `к ${placeTo(training.deployment.name)} помогать таскать снаряжение.`;

    return [
        heading,
        training.comment,
        details,
        training.weather,
        `Записываться по ссылке: ${url}`,
    ]
        .filter(Boolean)
        .join('\n\n');
}
