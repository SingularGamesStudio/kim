import { esc } from '../core/dom.js';
import { shortDate } from '../core/format.js';

/** Карточка тренировки в списке на главной. */
export function trainingCard(training) {
    const title = training.types.join(' / ') || 'Неопределённая тренировка';

    return `
        <a class="training-card" href="training.html?t=${esc(training.key)}">
            <div class="training-card-date">
                ${esc(shortDate(training.date, training.time))}
            </div>

            <div class="training-card-main">
                <p class="card-type">${esc(title)}</p>
                <p class="card-meta">
                    ${esc(training.venue.name)} · кворум ${esc(training.quorum)}
                </p>
            </div>

            <span class="card-arrow">→</span>
        </a>
    `;
}
