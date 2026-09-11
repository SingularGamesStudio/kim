import {
    BASE_URL,
    LOCATIONS,
    LOCATION_PRESETS,
    MAP_CENTER,
    TRAINING_TYPES,
} from '../config.js';
import { $, $$, render, setStatus, show } from '../core/dom.js';
import { clearToken, storedToken } from '../core/auth.js';
import { nearestFriday } from '../core/format.js';
import { createTraining, verifyAdminAccess } from '../data/trainings.js';
import {
    createMap,
    enableDragging,
    loadOl,
    marker,
    markerLocation,
    moveMarker,
} from '../features/map.js';
import { fetchForecast } from '../features/weather.js';
import { announcementText } from '../features/announcement.js';
import { creationResult } from '../views/creation-result.js';

const CUSTOM = 'custom';
const KINDS = ['deployment', 'venue'];

const defaultPreset = (kind) => LOCATION_PRESETS[kind][0];

const state = $('#auth-state');
const form = $('#training-form');
const markers = {};

/** Чекбоксы видов тренировки и <option> мест собираются из конфигурации. */
function renderFormOptions() {
    render(
        $('#type-grid'),
        TRAINING_TYPES.map(
            (type) => `
                <label class="check-card">
                    <input type="checkbox" name="type" value="${type}">
                    <span>${type}</span>
                </label>
            `,
        ).join(''),
    );

    KINDS.forEach((kind) => {
        const select = $(`#${kind}-preset`);

        render(
            select,
            [
                ...LOCATION_PRESETS[kind].map(
                    (name) => `<option value="${name}">${name}</option>`,
                ),
                `<option value="${CUSTOM}">Другое место</option>`,
            ].join(''),
        );

        select.value = defaultPreset(kind);
    });
}

async function initMap() {
    await loadOl();

    KINDS.forEach((kind) => {
        markers[kind] = marker(LOCATIONS[defaultPreset(kind)], kind);
    });

    const { map, layer } = createMap(
        $('#map'),
        KINDS.map((kind) => markers[kind]),
        MAP_CENTER,
    );

    enableDragging(map, layer);
}

/** Пресет переставляет крестик; «Другое место» оставляет его там, где он есть. */
function applyPreset(kind) {
    const preset = $(`#${kind}-preset`).value;

    show($(`#${kind}-custom-wrap`), preset === CUSTOM);

    if (preset !== CUSTOM) {
        moveMarker(markers[kind], LOCATIONS[preset]);
    }
}

function initPresets() {
    KINDS.forEach((kind) => {
        $(`#${kind}-preset`).addEventListener('change', () => applyPreset(kind));

        applyPreset(kind);
    });
}

function selectedLocation(kind) {
    const preset = $(`#${kind}-preset`).value;
    const customName = $(`#${kind}-custom`).value.trim();

    return {
        name: preset === CUSTOM ? customName || 'Другое место' : LOCATIONS[preset].name,
        ...markerLocation(markers[kind]),
    };
}

function readDraft() {
    return {
        createdAt: new Date().toISOString(),
        date: $('#date').value,
        time: $('#time').value,
        types: $$('[name="type"]:checked').map((input) => input.value),
        comment: $('#comment').value.trim(),
        deployment: selectedLocation('deployment'),
        venue: selectedLocation('venue'),
        quorum: Number($('#quorum').value),
    };
}

function showResult(training, forecast) {
    const url = new URL('training.html', BASE_URL);

    url.searchParams.set('t', training.key);

    show(form, false);

    const result = $('#result');

    render(
        result,
        creationResult({
            url: url.toString(),
            postText: announcementText(training, url.toString()),
            forecast,
        }),
    );

    show(result);

    $('#copy-post').addEventListener('click', async (event) => {
        await navigator.clipboard.writeText($('#post-text').value);

        const button = event.currentTarget;

        button.textContent = 'Скопировано';

        setTimeout(() => {
            button.textContent = 'Копировать';
        }, 1800);
    });
}

function initSubmit() {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const draft = readDraft();

        if (!draft.types.length) {
            setStatus(state, 'Выберите хотя бы один вид тренировки.', true);

            return;
        }

        const button = form.querySelector('[type="submit"]');

        button.disabled = true;
        button.textContent = 'Создаём…';

        setStatus(state, 'Запрашиваем прогноз и записываем тренировку…');

        try {
            const forecast = await fetchForecast(draft);

            const training = await createTraining(
                { ...draft, weather: forecast.text },
                storedToken(),
            );

            showResult(training, forecast);
        } catch (error) {
            console.error(error);

            setStatus(state, `Не удалось создать тренировку: ${error.message}`, true);

            button.disabled = false;
            button.textContent = 'Создать тренировку';
        }
    });
}

async function init() {
    /*
     * Сюда попадают только после кнопки на главной, где уже был popup Google.
     * Токен лежит в sessionStorage, второй вход не нужен.
     */
    if (!storedToken()) {
        render(
            state,
            'Не удалось подтвердить аккаунт — откройте ' +
                '<a href="index.html">главную страницу</a> ' +
                'и нажмите «Создать тренировку».',
        );

        return;
    }

    setStatus(state, 'Проверяем доступ к закрытой таблице…');

    try {
        await verifyAdminAccess(storedToken());
    } catch (error) {
        console.error(error);

        clearToken();

        render(
            state,
            'Сессия закончилась или у аккаунта нет прав. Вернитесь на ' +
                '<a href="index.html">главную</a> и войдите снова.',
        );

        return;
    }

    renderFormOptions();

    try {
        await initMap();
    } catch (error) {
        console.warn(error);

        setStatus(state, 'Не удалось загрузить карту. Обновите страницу.', true);

        return;
    }

    initPresets();
    initSubmit();

    $('#date').value = nearestFriday();

    setStatus(state, '');

    show(form);
}

init();
