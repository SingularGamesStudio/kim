import { CANCEL_MARK, NEUTRAL_VOTE } from '../config.js';
import { esc } from '../core/dom.js';
import { commentTime, normalizeName, plural } from '../core/format.js';

/** Голосование появляется только если у тренировки несколько форматов. */
export const hasVote = (training) => training.types.length > 1;

export const voteOptions = (training) => [...training.types, NEUTRAL_VOTE];

/**
 * Отмена записи — это обычный комментарий, начинающийся с технического
 * символа. Список остаётся append-only: важен только последний комментарий
 * участника.
 */
const isCancel = (comment) => String(comment.text ?? '').startsWith(CANCEL_MARK);

const withoutMark = (comment) =>
    String(comment.text ?? '').slice(CANCEL_MARK.length).trim();

/**
 * Комментарии → участники, в порядке первого появления имени.
 * Для каждого: отменена ли запись и какой формат он выбрал последним.
 */
export function participants(comments) {
    const byName = new Map();

    for (const comment of comments) {
        const key = normalizeName(comment.name);

        if (!key) {
            continue;
        }

        if (!byName.has(key)) {
            byName.set(key, { key, name: comment.name, comments: [] });
        }

        byName.get(key).comments.push(comment);
    }

    for (const participant of byName.values()) {
        const { comments: own } = participant;

        participant.cancelled = isCancel(own[own.length - 1]);
        participant.choice =
            [...own].reverse().find((comment) => comment.choice)?.choice ?? '';
    }

    return byName;
}

/** Запись участника с таким именем, если она уже есть. */
export const findParticipant = (comments, name) =>
    participants(comments).get(normalizeName(name)) ?? null;

const active = (comments) =>
    [...participants(comments).values()].filter((one) => !one.cancelled);

/** Радиокнопки выбора формата. Прошлый выбор участника проставляется сразу. */
export function voteFieldset(training, selected = '') {
    if (!hasVote(training)) {
        return '';
    }

    const choices = voteOptions(training)
        .map(
            (option) => `
                <label class="vote-choice">
                    <input type="radio" name="choice" value="${esc(option)}"
                        ${option === selected ? 'checked' : ''}>
                    <span>${esc(option)}</span>
                </label>
            `,
        )
        .join('');

    return `
        <fieldset class="vote-fieldset">
            <legend>Что проведём?</legend>
            <div class="vote-choice-grid">${choices}</div>
        </fieldset>
    `;
}

/** «· 5 участников · кворум 8» — отменившие не считаются. */
export function participantCount(training, comments) {
    const count = active(comments).length;

    return (
        `· ${count} ${plural(count, 'участник', 'участника', 'участников')}` +
        ` · кворум ${training.quorum}`
    );
}

/** Итоги голосования: один голос на человека, отменившие не учитываются. */
export function voteResults(training, comments) {
    if (!hasVote(training)) {
        return '';
    }

    const options = voteOptions(training);
    const counts = new Map(options.map((option) => [option, 0]));

    for (const { choice } of active(comments)) {
        if (counts.has(choice)) {
            counts.set(choice, counts.get(choice) + 1);
        }
    }

    return options
        .map(
            (option) => `
                <div class="vote-result-card">
                    <span class="vote-result-label">${esc(option)}</span>
                    <strong class="vote-result-count">${counts.get(option)}</strong>
                </div>
            `,
        )
        .join('');
}

function commentLine(comment) {
    const cancelled = isCancel(comment);
    const text = cancelled ? withoutMark(comment) : String(comment.text || '+');
    const isPlus = !cancelled && text.trim() === '+';

    return `
        <div class="entry-comment">
            <span class="entry-comment-text ${isPlus ? 'entry-plus' : ''}">
                ${cancelled ? '<em>Отменил запись.</em> ' : ''}${esc(text)}
            </span>
            <time>${esc(commentTime(comment.sentAt))}</time>
        </div>
    `;
}

/** Список участников: у отменивших весь блок красноватый. */
export function commentEntries(comments) {
    const people = [...participants(comments).values()];

    if (!people.length) {
        return '<p class="empty-state">Пока никто не записался.</p>';
    }

    return people
        .map(
            (person) => `
                <article class="participant-entry ${
                    person.cancelled ? 'entry-cancelled' : ''
                }">
                    <div class="participant-name">${esc(person.name)}</div>
                    <div class="participant-comments">
                        ${person.comments.map(commentLine).join('')}
                    </div>
                </article>
            `,
        )
        .join('');
}
