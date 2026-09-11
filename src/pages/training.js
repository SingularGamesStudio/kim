import {
    $,
    afterPaint,
    errorBlock,
    render,
    setStatus,
    show,
} from '../core/dom.js';
import { isValidKey } from '../core/columns.js';
import { getTraining } from '../data/trainings.js';
import { listComments, submitComment, waitForComment } from '../data/comments.js';
import { createMap, fitBoth, loadOl, marker } from '../features/map.js';
import { trainingHero } from '../views/training-hero.js';
import {
    commentEntries,
    hasVote,
    participantCount,
    voteFieldset,
    voteResults,
} from '../views/comments.js';

const NAME_STORAGE_KEY = 'kimSignupName';
const SAFETY_STORAGE_KEY = 'kimSafetyDismissed';

const key = new URLSearchParams(location.search).get('t');

let training = null;
let comments = [];

/*
 * Запросы стартуют сразу при загрузке модуля и идут параллельно:
 * тренировка и комментарии лежат в разных таблицах, поэтому объединить
 * их в один batchGet нельзя — но ждать друг друга они не должны.
 */
const trainingRequest = isValidKey(key) ? getTraining(key) : null;

const commentsRequest = isValidKey(key)
    ? listComments(key).catch((error) => {
          console.error(error);

          return [];
      })
    : null;

function initSafetyBanner() {
    const banner = $('#safety');

    if (localStorage.getItem(SAFETY_STORAGE_KEY) === '1') {
        banner?.remove();

        return;
    }

    $('#hide-safety')?.addEventListener('click', () => {
        localStorage.setItem(SAFETY_STORAGE_KEY, '1');

        banner?.remove();
    });
}

function renderComments() {
    setStatus($('#participant-count'), participantCount(comments));

    render($('#vote-results'), voteResults(training, comments));
    render($('#entries'), commentEntries(comments));
}

/** Карта инициализируется последней: она самая тяжёлая часть страницы. */
async function renderMap() {
    const loader = $('#map-loader');
    const status = $('#map-status');

    show($('#map-section'));

    try {
        await loadOl();

        const { map, tiles } = createMap(
            $('#map'),
            [
                marker(training.deployment, 'deployment'),
                marker(training.venue, 'venue'),
            ],
            training.deployment,
        );

        fitBoth(map, training.deployment, training.venue);

        map.once('rendercomplete', () => show(loader, false));

        tiles.on('tileloaderror', () => {
            setStatus(status, 'Часть карты не удалось загрузить.');
        });
    } catch (error) {
        console.warn(error);

        setStatus(status, 'Не удалось загрузить карту.');
    }
}

function initSignupForm() {
    const form = $('#signup-form');
    const nameInput = $('#name');
    const commentInput = $('#signup-comment');
    const message = $('#signup-message');
    const submitButton = form.querySelector('[type="submit"]');

    render($('#vote-options'), voteFieldset(training));

    nameInput.value = localStorage.getItem(NAME_STORAGE_KEY) ?? '';

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Honeypot: ботам поле видно, людям — нет.
        if ($('#website').value) {
            return;
        }

        const name = nameInput.value.trim();

        if (!name) {
            setStatus(message, 'Введите имя или позывной.', true);
            nameInput.focus();

            return;
        }

        const choice = hasVote(training)
            ? ($('[name="choice"]:checked')?.value ?? '')
            : '';

        // Форма с novalidate, поэтому выбор формата проверяем сами.
        if (hasVote(training) && !choice) {
            setStatus(message, 'Выберите, какой формат вы хотите.', true);

            return;
        }

        const text = commentInput.value.trim() || '+';

        localStorage.setItem(NAME_STORAGE_KEY, name);

        submitButton.disabled = true;

        /*
         * Комментарий рисуется сразу, не дожидаясь Apps Script.
         * Дальше мы лишь подтверждаем запись перечитыванием блока.
         */
        comments = [...comments, { name, text, choice, sentAt: new Date().toISOString() }];

        renderComments();

        commentInput.value = '';

        setStatus(message, 'Сохраняем…');

        try {
            await submitComment({ key, name, text, choice });

            comments = await waitForComment(key, name, text);

            renderComments();

            setStatus(message, 'Готово: вы записаны.');
        } catch (error) {
            console.error(error);

            setStatus(message, `Не удалось подтвердить запись: ${error.message}`, true);
        } finally {
            submitButton.disabled = false;
        }
    });
}

async function load() {
    if (!isValidKey(key)) {
        render($('#training'), errorBlock('В ссылке нет корректного ID тренировки.'));

        return;
    }

    initSafetyBanner();

    try {
        training = await trainingRequest;
    } catch (error) {
        console.error(error);

        render(
            $('#training'),
            errorBlock('Не удалось загрузить тренировку.', error.message),
        );

        return;
    }

    render($('#training'), trainingHero(training));

    show($('#signup-section'));
    show($('#entries-section'));

    initSignupForm();

    comments = await commentsRequest;

    renderComments();

    afterPaint(renderMap);
}

load();
