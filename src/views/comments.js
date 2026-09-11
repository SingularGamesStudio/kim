import { NEUTRAL_VOTE } from '../config.js';
import { esc } from '../core/dom.js';
import { commentTime, normalizeName, plural } from '../core/format.js';

/** Голосование появляется только если у тренировки несколько форматов. */
export const hasVote = (training) => training.types.length > 1;

export const voteOptions = (training) => [...training.types, NEUTRAL_VOTE];

/** Радиокнопки выбора формата в форме записи. */
export function voteFieldset(training) {
    if (!hasVote(training)) {
        return '';
    }

    const choices = voteOptions(training)
        .map(
            (option) => `
                <label class="vote-choice">
                    <input required type="radio" name="choice" value="${esc(option)}">
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

/** «· 5 участников» — по уникальным именам. */
export function participantCount(comments) {
    const names = new Set(
        comments.map((comment) => normalizeName(comment.name)).filter(Boolean),
    );

    return `· ${names.size} ${plural(
        names.size,
        'участник',
        'участника',
        'участников',
    )}`;
}

/** Итоги голосования: один голос на человека, считается последний. */
export function voteResults(training, comments) {
    if (!hasVote(training)) {
        return '';
    }

    const latestByName = new Map();

    for (const comment of comments) {
        const name = normalizeName(comment.name);

        if (name && comment.choice) {
            latestByName.set(name, comment.choice);
        }
    }

    const options = voteOptions(training);
    const counts = new Map(options.map((option) => [option, 0]));

    for (const choice of latestByName.values()) {
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
    const text = comment.text || '+';
    const isPlus = text.trim() === '+';

    return `
        <div class="entry-comment">
            <span class="entry-comment-text ${isPlus ? 'entry-plus' : ''}">
                ${esc(text)}
            </span>
            <time>${esc(commentTime(comment.sentAt))}</time>
        </div>
    `;
}

/**
 * Комментарии, сгруппированные по человеку.
 * Map сохраняет порядок первого появления имени, поэтому все реплики
 * одного участника оказываются под его первым комментарием.
 */
export function commentEntries(comments) {
    const byName = new Map();

    for (const comment of comments) {
        const name = normalizeName(comment.name);

        if (!name) {
            continue;
        }

        byName.set(name, [...(byName.get(name) ?? []), comment]);
    }

    if (!byName.size) {
        return '<p class="empty-state">Пока никто не записался.</p>';
    }

    return [...byName.values()]
        .map(
            (entries) => `
                <article class="participant-entry">
                    <div class="participant-name">${esc(entries[0].name)}</div>
                    <div class="participant-comments">
                        ${entries.map(commentLine).join('')}
                    </div>
                </article>
            `,
        )
        .join('');
}
