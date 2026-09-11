/** Минимальные DOM-хелперы. Нужны, чтобы не повторять querySelector и escaping. */

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
];

/** Экранирование текста для вставки в шаблонную строку HTML. */
export function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

export function show(element, visible = true) {
    element?.classList.toggle('hidden', !visible);
}

/** Заменяет содержимое узла HTML-строкой. */
export function render(element, html) {
    if (element) {
        element.innerHTML = html;
    }
}

export function setStatus(element, text, isError = false) {
    if (!element) {
        return;
    }

    element.textContent = text;
    element.classList.toggle('status-error', isError);

    // Пустая строка = статуса нет, узел не должен занимать место.
    show(element, Boolean(text));
}

export function errorBlock(text, detail = '') {
    return `
        <p class="error-state">
            ${esc(text)}
            ${detail ? `<br><br><small>${esc(detail)}</small>` : ''}
        </p>
    `;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ждёт, пока браузер отрисует уже применённые изменения DOM,
 * и только потом запускает тяжёлую работу (инициализацию карты).
 */
export function afterPaint(callback) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimeout(callback, 0));
    });
}
