let map;
let deploymentFeature;
let venueFeature;

document.addEventListener("DOMContentLoaded", async () => {
    const state = document.querySelector("#auth-state");
    const form = document.querySelector("#training-form");

    /*
     * На эту страницу можно попасть только после кнопки на index.
     * Token уже лежит в sessionStorage — popup здесь не нужен.
     */
    if (!getStoredAccessToken()) {
        state.innerHTML = `
            Не удалось подтвердить аккаунт - для создания тренировки откройте
            <a href="index.html">главную страницу</a>
            и нажмите «Создать тренировку».
        `;

        return;
    }

    try {
        state.textContent =
            "Проверяем доступ к закрытой таблице…";

        await requireAdmin();

        state.textContent = "Доступ подтверждён.";
        form.classList.remove("hidden");

        document.querySelector("#date").value =
            nearestFriday();

        initializeMap();
        initializeLocationControls();
        initializeSubmit();
    } catch (error) {
        console.error(error);

        clearStoredAccessToken();

        state.innerHTML = `
            Сессия закончилась или у аккаунта нет прав.
            Вернитесь на <a href="index.html">главную</a>
            и войдите снова.
        `;
    }
});

function nearestFriday() {
    const date = new Date();
    const delta = (5 - date.getDay() + 7) % 7;

    date.setDate(date.getDate() + delta);

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function initializeMap() {
    const mipT = C.LOCATIONS.MIPT;

    deploymentFeature = markerFeature(
        C.LOCATIONS["8ка"],
        "deployment"
    );

    venueFeature = markerFeature(
        C.LOCATIONS["Обезьянник"],
        "venue"
    );

    const vectorSource = new ol.source.Vector({
        features: [
            deploymentFeature,
            venueFeature
        ]
    });

    const vectorLayer = new ol.layer.Vector({
        source: vectorSource,
        style: markerStyle
    });

    map = new ol.Map({
        target: "map",

        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),

            vectorLayer
        ],

        view: new ol.View({
            center: ol.proj.fromLonLat([
                mipT.lng,
                mipT.lat
            ]),

            zoom: 16
        })
    });

    /*
     * Важно:
     * не передаём оба feature через `features`.
     *
     * Translate сам выбирает feature под курсором на vectorLayer.
     * Поэтому перетаскивается только тот крестик, за который
     * пользователь реально взялся мышью/пальцем.
     */
    map.addInteraction(
        new ol.interaction.Translate({
            layers: [vectorLayer]
        })
    );
}

function markerFeature(location, kind) {
    const feature = new ol.Feature({
        geometry: new ol.geom.Point(
            ol.proj.fromLonLat([
                location.lng,
                location.lat
            ])
        ),
        kind
    });

    return feature;
}

function markerStyle(feature) {
    const color =
        feature.get("kind") === "deployment"
            ? "#19ad6e"
            : "#e54b4b";

    return new ol.style.Style({
        text: new ol.style.Text({
            text: "✚",

            font: "700 32px system-ui, sans-serif",

            fill: new ol.style.Fill({
                color
            }),

            stroke: new ol.style.Stroke({
                color: "#ffffff",
                width: 4
            }),

            offsetY: -2
        })
    });
}

function initializeLocationControls() {
    for (const kind of ["deployment", "venue"]) {
        document
            .querySelector(`#${kind}-preset`)
            .addEventListener("change", () => {
                syncPresetLocation(kind);
            });

        syncPresetLocation(kind);
    }
}

function syncPresetLocation(kind) {
    const preset = document.querySelector(
        `#${kind}-preset`
    ).value;

    const customWrap = document.querySelector(
        `#${kind}-custom-wrap`
    );

    customWrap.classList.toggle(
        "hidden",
        preset !== "custom"
    );

    if (preset === "custom") {
        return;
    }

    const location = C.LOCATIONS[preset];
    const feature =
        kind === "deployment"
            ? deploymentFeature
            : venueFeature;

    feature.getGeometry().setCoordinates(
        ol.proj.fromLonLat([
            location.lng,
            location.lat
        ])
    );
}

function selectedLocation(kind) {
    const preset = document.querySelector(
        `#${kind}-preset`
    ).value;

    const customName = document.querySelector(
        `#${kind}-custom`
    ).value.trim();

    const feature =
        kind === "deployment"
            ? deploymentFeature
            : venueFeature;

    const [lng, lat] = ol.proj.toLonLat(
        feature.getGeometry().getCoordinates()
    );

    if (preset !== "custom") {
        return {
            name: C.LOCATIONS[preset].name,
            lat,
            lng
        };
    }

    return {
        name: customName || "Другое место",
        lat,
        lng
    };
}

function initializeSubmit() {
    document
        .querySelector("#training-form")
        .addEventListener("submit", async (event) => {
            event.preventDefault();

            const types = [
                ...document.querySelectorAll(
                    '[name="type"]:checked'
                )
            ].map((input) => input.value);

            if (!types.length) {
                alert("Выберите хотя бы один вид тренировки.");
                return;
            }

            const training = {
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                date: document.querySelector("#date").value,
                time: document.querySelector("#time").value,
                types,
                comment: document
                    .querySelector("#comment")
                    .value
                    .trim(),
                deployment: selectedLocation("deployment"),
                venue: selectedLocation("venue"),
                quorum: Number(
                    document.querySelector("#quorum").value
                )
            };

            const button = event.submitter;

            button.disabled = true;
            button.textContent = "Создаём…";

            try {
                const weatherResult =
                    await fetchWeather(training);

                training.weather = weatherResult.text;
                training.weatherOk = weatherResult.ok;
                training.weatherReason = weatherResult.reason;

                await appendTraining(training);

                const url = new URL(
                    "training.html",
                    C.BASE_URL
                );

                url.searchParams.set("id", training.id);

                showResult(training, url.toString());
            } catch (error) {
                console.error(error);

                alert(
                    `Не удалось создать тренировку: ${error.message}`
                );

                button.disabled = false;
                button.textContent =
                    "Создать тренировку";
            }
        });
}

async function fetchWeather(training) {
    const start = new Date(
        `${training.date}T${training.time}:00+03:00`
    );

    const maxForecastDistanceMs =
        16 * 24 * 60 * 60 * 1000;

    if (
        start.getTime() - Date.now() >
        maxForecastDistanceMs
    ) {
        return {
            ok: false,
            text: "Прогноз погоды уточняется.",
            reason:
                "Дата тренировки находится за пределами 16-дневного горизонта прогноза."
        };
    }

    const params = new URLSearchParams({
        latitude: String(training.venue.lat),
        longitude: String(training.venue.lng),
        hourly:
            "temperature_2m,precipitation_probability,precipitation",
        timezone: "Europe/Moscow",
        forecast_days: "16"
    });

    const url =
        `https://api.open-meteo.com/v1/forecast?${params}`;

    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 9_000);

        try {
            const response = await fetch(url, {
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(
                    `Open-Meteo HTTP ${response.status}`
                );
            }

            const data = await response.json();

            const forecast = buildWeatherText(
                data,
                start
            );

            if (!forecast) {
                throw new Error(
                    "В прогнозе нет данных на нужное время."
                );
            }

            return {
                ok: true,
                text: forecast,
                reason: ""
            };
        } catch (error) {
            clearTimeout(timeout);

            lastError = error;

            console.warn(
                `Weather request attempt ${attempt} failed:`,
                error
            );

            if (attempt < 2) {
                await sleep(900);
            }
        }
    }

    return {
        ok: false,
        text: "Прогноз погоды уточняется.",
        reason:
            lastError?.message ||
            "Неизвестная ошибка при запросе прогноза."
    };
}

function buildWeatherText(data, start) {
    if (
        !data?.hourly?.time ||
        !data?.hourly?.temperature_2m ||
        !data?.hourly?.precipitation_probability ||
        !data?.hourly?.precipitation
    ) {
        return null;
    }

    /*
     * Берём окно ±2 часа от начала:
     * температура усредняется,
     * вероятность осадков — максимум,
     * осадки — сумма по окну.
     */
    const relevantIndexes = [-2, -1, 0, 1, 2]
        .map((offset) => {
            const date = new Date(
                start.getTime() +
                offset * 60 * 60 * 1000
            );

            return moscowHourIndex(date);
        })
        .map((time) => {
            return data.hourly.time.indexOf(time);
        })
        .filter((index) => index >= 0);

    if (!relevantIndexes.length) {
        return null;
    }

    const temperatures = relevantIndexes.map(
        (index) => {
            return data.hourly.temperature_2m[index];
        }
    );

    const probabilities = relevantIndexes.map(
        (index) => {
            return data.hourly
                .precipitation_probability[index];
        }
    );

    const precipitation = relevantIndexes.map(
        (index) => {
            return data.hourly.precipitation[index];
        }
    );

    const averageTemperature =
        temperatures.reduce((sum, value) => {
            return sum + value;
        }, 0) / temperatures.length;

    const temperature = Math.round(
        averageTemperature
    );

    const maxProbability = Math.max(
        ...probabilities
    );

    const precipitationAmount =
        precipitation.reduce((sum, value) => {
            return sum + value;
        }, 0);

    const sign = temperature > 0 ? "+" : "";

    let precipitationText =
        "без существенных осадков";

    if (
        maxProbability >= 60 ||
        precipitationAmount >= 1
    ) {
        precipitationText =
            `осадки вероятны до ${maxProbability}%` +
            `, около ${precipitationAmount.toFixed(1)} мм`;
    } else if (maxProbability >= 30) {
        precipitationText =
            `небольшая вероятность осадков: до ${maxProbability}%`;
    }

    return (
        `Прогноз: ${sign}${temperature}°C, ` +
        `${precipitationText}.`
    );
}

function moscowHourIndex(date) {
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);

    const value = Object.fromEntries(
        parts
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value])
    );

    return (
        `${value.year}-${value.month}-${value.day}` +
        `T${value.hour}:00`
    );
}

function showResult(training, url) {
    document
        .querySelector("#training-form")
        .classList.add("hidden");

    const text = announcementText(training, url);
    const result = document.querySelector("#result");

    result.classList.remove("hidden");

    const weatherWarning = !training.weatherOk
    ? `
        <section class="weather-warning">
            <p class="weather-warning-title">
                Внимание: прогноз не был получен
            </p>

            <p>
                В тексте поста оставлено:
                «Прогноз погоды уточняется».
            </p>

            <p class="weather-warning-detail">
                Техническая причина:
                ${esc(training.weatherReason)}
            </p>
        </section>
    `
    : "";

    result.innerHTML = `
        ${weatherWarning}

        <section class="success-panel">
            <p class="eyebrow">Готово</p>
            <h2>Тренировка создана</h2>

            <p>
                <a href="${esc(url)}">
                    Открыть страницу записи участников
                </a>
            </p>
        </section>

        <section class="post-panel">
            <div class="post-panel-heading">
                <h2>Текст для VK и Telegram</h2>

                <button
                    id="copy-post"
                    class="button button-secondary"
                    type="button"
                >
                    Копировать
                </button>
            </div>

            <textarea
                id="post-text"
                readonly
                rows="17"
            >${esc(text)}</textarea>
        </section>
    `;

    document
        .querySelector("#copy-post")
        .addEventListener("click", async (event) => {
            const post = document.querySelector("#post-text");

            await navigator.clipboard.writeText(post.value);

            event.currentTarget.textContent = "Скопировано";

            setTimeout(() => {
                event.currentTarget.textContent = "Копировать";
            }, 1800);
        });
}

function announcementText(training, url) {
    const title = announcementTitle(training.types);

    const date = announcementDate(training.date);

    const voteText =
        training.types.length > 1
            ? "За формат голосуйте на сайте.\n\n"
            : "";

    const commentText = training.comment
        ? `${training.comment}\n\n`
        : "";

    const deploymentAt = placeAt(
        training.deployment.name
    );

    const deploymentTo = placeTo(
        training.deployment.name
    );

    const lateTime = addMinutes(
        training.time,
        30
    );

    return `${title} ${date}.
${voteText}${commentText}Начало в ${training.time} у ${deploymentAt}, место тренировки — ${training.venue.name}. Даже если вы опаздываете до ${lateTime}, подходите сначала к ${deploymentTo} помогать таскать снаряжение.

${training.weather}

Записываться по ссылке: ${url}`;
}

function announcementTitle(types) {
    if (types.length > 1) {
        return "Фехтовальная тренировка";
    }

    const type = types[0] || "";

    if (
        type === "Мягкая Дуэльная" ||
        type === "Твёрдая Дуэльная"
    ) {
        return "Дуэльная тренировка";
    }

    if (type === "Мягкая строевая") {
        return "Тактическая тренировка";
    }

    if (type === "Крафт") {
        return "Крафт";
    }

    return "Фехтовальная тренировка";
}

function announcementDate(isoDate) {
    const date = new Date(
        `${isoDate}T12:00:00+03:00`
    );

    const weekdays = {
        0: {
            preposition: "в",
            name: "воскресенье"
        },

        1: {
            preposition: "в",
            name: "понедельник"
        },

        2: {
            preposition: "во",
            name: "вторник"
        },

        3: {
            preposition: "в",
            name: "среду"
        },

        4: {
            preposition: "в",
            name: "четверг"
        },

        5: {
            preposition: "в",
            name: "пятницу"
        },

        6: {
            preposition: "в",
            name: "субботу"
        }
    };

    const weekday = weekdays[date.getDay()];

    const dayMonth = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Moscow"
    }).format(date);

    return `${weekday.preposition} ${weekday.name}, ${dayMonth}`;
}

function normalizePlaceName(place) {
    return String(place || "")
        .trim()
        .toLocaleLowerCase("ru-RU")
        .replaceAll("ё", "е");
}

/*
 * Форма места после «у».
 *
 * 8ка / восьмерка:
 * у восьмерки
 *
 * КПМ:
 * у КПМ
 *
 * Кастомное место:
 * у <как введено админом>
 */
function placeAt(place) {
    const normalized = normalizePlaceName(place);

    if (
        normalized === "8ка" ||
        normalized === "8-ка" ||
        normalized === "восьмерка"
    ) {
        return "восьмерки";
    }

    return place;
}

/*
 * Форма места после «к».
 *
 * 8ка / восьмерка:
 * к восьмерке
 *
 * КПМ:
 * к КПМ
 *
 * Кастомное место:
 * к <как введено админом>
 */
function placeTo(place) {
    const normalized = normalizePlaceName(place);

    if (
        normalized === "8ка" ||
        normalized === "8-ка" ||
        normalized === "восьмерка"
    ) {
        return "восьмерке";
    }

    return place;
}

function addMinutes(time, minutesToAdd) {
    const [hoursRaw, minutesRaw] = time
        .split(":")
        .map(Number);

    const total =
        hoursRaw * 60 +
        minutesRaw +
        minutesToAdd;

    const hours = Math.floor(total / 60) % 24;
    const minutes = total % 60;

    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0")
    ].join(":");
}