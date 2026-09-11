import { esc } from '../core/dom.js';

/** Предупреждение, если прогноз погоды получить не удалось. */
const weatherWarning = (forecast) =>
    forecast.ok
        ? ''
        : `
            <section class="weather-warning">
                <p class="weather-warning-title">
                    Внимание: прогноз не был получен
                </p>

                <p>В тексте поста оставлено: «Прогноз погоды уточняется».</p>

                <p class="weather-warning-detail">
                    Техническая причина: ${esc(forecast.reason)}
                </p>
            </section>
        `;

/** Экран после создания тренировки: ссылка и готовый текст поста. */
export function creationResult({ url, postText, forecast }) {
    return `
        ${weatherWarning(forecast)}

        <section class="success-panel">
            <p class="eyebrow">Готово</p>
            <h2>Тренировка создана</h2>

            <p>
                <a href="${esc(url)}">Открыть страницу записи участников</a>
            </p>
        </section>

        <section class="post-panel">
            <div class="post-panel-heading">
                <h2>Текст для VK и Telegram</h2>

                <button id="copy-post" class="button button-secondary" type="button">
                    Копировать
                </button>
            </div>

            <textarea id="post-text" readonly rows="17">${esc(postText)}</textarea>
        </section>
    `;
}
