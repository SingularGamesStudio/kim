import { SAFETY_URL } from '../config.js';
import { esc } from '../core/dom.js';
import { addMinutes, fullDate, placeTo } from '../core/format.js';

/** Насколько позже начала ещё имеет смысл идти к точке сбора. */
const LATE_MINUTES = 30;

const fact = (label, value) => `
    <div class="fact">
        <span class="fact-label">${esc(label)}</span>
        <strong>${value}</strong>
    </div>
`;

const place = (name, note, noteClass) => `
    ${esc(name)}
    <span class="marker-note ${noteClass}">(${esc(note)})</span>
`;

/** Шапка страницы тренировки: заголовок, дата, факты, памятка. */
export function trainingHero(training) {
    const title = training.types.join(' / ') || 'Неопределённая тренировка';

    return `
        <p class="eyebrow">Анонс тренировки</p>

        <h1>${esc(title)}</h1>

        <p class="training-date">
            ${esc(fullDate(training.date))}
            <span class="date-separator">·</span>
            начало в ${esc(training.time)}
        </p>

        ${
            training.comment
                ? `<p class="training-comment">${esc(training.comment)}</p>`
                : ''
        }

        <div class="training-facts">
            ${fact(
                'Сбор и деплой',
                place(training.deployment.name, 'зелёный крестик', 'marker-green'),
            )}
            ${fact(
                'Место тренировки',
                place(training.venue.name, 'красный крестик', 'marker-red'),
            )}
            ${fact('Кворум', `${esc(training.quorum)} чел.`)}
        </div>

        <div class="training-notes">
            <p>
                Отсечка — за 2 часа до начала.
                Если опаздываете до ${esc(addMinutes(training.time, LATE_MINUTES))},
                сначала подойдите к ${esc(placeTo(training.deployment.name))}.
            </p>

            ${
                training.weather
                    ? `<p class="weather-line">${esc(training.weather)}</p>`
                    : ''
            }
        </div>

        <details class="training-guidance">
            <summary>Что взять и что прочитать</summary>

            <div class="training-guidance-content">
                <p>
                    Берите с собой перчатки для защиты рук от мозолей
                    и не только.
                </p>

                <p>
                    Для допуска к занятиям необходимо прочитать
                    <a target="_blank" rel="noopener" href="${esc(SAFETY_URL)}">
                        краткую инструкцию по технике безопасности
                    </a>
                    и расписаться за инструктаж на тренировке.
                </p>

                <p>
                    Вопросы по инструкции и запрос полной версии ТБ можно
                    задавать в сообщения группы или в чате тренировок.
                </p>
            </div>
        </details>
    `;
}
