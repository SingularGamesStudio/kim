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
            "temperature_2m,precipitation_probability,precipitation," +
            "weather_code,wind_speed_10m,wind_gusts_10m",
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
    const hourly = data?.hourly;

    if (
        !hourly?.time ||
        !hourly?.temperature_2m ||
        !hourly?.precipitation_probability ||
        !hourly?.precipitation ||
        !hourly?.weather_code ||
        !hourly?.wind_speed_10m
    ) {
        return null;
    }

    /*
     * Рассматриваем интервал от двух часов до начала до двух часов
     * после начала. Это полезнее одной точки во времени:
     * осадки могут сдвинуться на час, а участники идут до точки сбора
     * до формального начала.
     */
    const indexes = [-2, -1, 0, 1, 2]
        .map((offset) => {
            const date = new Date(
                start.getTime() +
                offset * 60 * 60 * 1000
            );

            const hour = moscowHourIndex(date);

            return hourly.time.indexOf(hour);
        })
        .filter((index) => index >= 0);

    if (!indexes.length) {
        return null;
    }

    const temperatures = indexes.map((index) => {
        return Number(hourly.temperature_2m[index]);
    });

    const precipitationProbabilities = indexes.map(
        (index) => {
            return Number(
                hourly.precipitation_probability[index]
            );
        }
    );

    const precipitationAmounts = indexes.map(
        (index) => {
            return Number(hourly.precipitation[index]);
        }
    );

    const weatherCodes = indexes.map((index) => {
        return Number(hourly.weather_code[index]);
    });

    const windSpeeds = indexes.map((index) => {
        return Number(hourly.wind_speed_10m[index]);
    });

    const windGusts = Array.isArray(hourly.wind_gusts_10m)
        ? indexes.map((index) => {
            return Number(hourly.wind_gusts_10m[index]);
        })
        : [];

    const averageTemperature = average(temperatures);

    const temperature = Math.round(
        averageTemperature
    );

    const maxPrecipitationProbability = Math.max(
        ...precipitationProbabilities
    );

    const totalPrecipitation = sum(
        precipitationAmounts
    );

    const maxWindSpeed = Math.max(...windSpeeds);

    const maxWindGust = windGusts.length
        ? Math.max(...windGusts)
        : 0;

    const weatherDescription = weatherText(
        weatherCodes,
        maxPrecipitationProbability,
        totalPrecipitation,
        averageTemperature
    );

    const windDescription = windText(
        maxWindSpeed,
        maxWindGust
    );

    const temperatureSign =
        temperature > 0 ? "+" : "";

    const weatherParts = [
        `${temperatureSign}${temperature}°C`
    ];

    if (weatherDescription) {
        weatherParts.push(weatherDescription);
    }

    if (windDescription) {
        weatherParts.push(windDescription);
    }

    return `Прогноз: ${weatherParts.join(", ")}.`;
}

function weatherText(
    weatherCodes,
    maxProbability,
    totalPrecipitation,
    averageTemperature
) {
    const codes = new Set(weatherCodes);

    const hasThunderstorm = hasAnyCode(
        codes,
        [95, 96, 99]
    );

    const hasHeavySnow = hasAnyCode(
        codes,
        [75, 86]
    );

    const hasSnow = hasAnyCode(
        codes,
        [71, 73, 77, 85]
    );

    const hasFreezingRain = hasAnyCode(
        codes,
        [56, 57, 66, 67]
    );

    const hasHeavyRain = hasAnyCode(
        codes,
        [65, 82]
    );

    const hasRain = hasAnyCode(
        codes,
        [53, 55, 63, 80, 81]
    );

    const hasLightRain = hasAnyCode(
        codes,
        [51, 61]
    );

    /*
     * Приоритет:
     * гроза → метель/сильный снег → снег → ледяной дождь →
     * дождь → небольшой дождь.
     *
     * WMO weather_code — более надёжный индикатор типа осадков,
     * чем только precipitation amount. Температура используется
     * как дополнительная страховка для пограничных случаев.
     */
    if (hasThunderstorm) {
        return "гроза";
    }

    if (hasHeavySnow) {
        return "метель";
    }

    if (hasSnow) {
        return "снег";
    }

    if (hasFreezingRain) {
        return "ледяной дождь";
    }

    if (hasHeavyRain) {
        return "сильный дождь";
    }

    if (hasRain) {
        return "дождь";
    }

    if (hasLightRain) {
        return "небольшой дождь";
    }

    /*
     * Fallback: иногда weather_code может быть неинформативным,
     * но API уже сообщает ненулевую вероятность/количество осадков.
     */
    if (
        maxProbability >= 70 ||
        totalPrecipitation >= 3
    ) {
        return averageTemperature <= 1
            ? "снег"
            : "дождь";
    }

    if (
        maxProbability >= 35 ||
        totalPrecipitation >= 0.2
    ) {
        return averageTemperature <= 1
            ? "небольшой снег"
            : "небольшой дождь";
    }

    return "";
}

function windText(maxWindSpeed, maxWindGust) {
    /*
     * Значения в км/ч, так как Open-Meteo использует km/h
     * по умолчанию.
     *
     * 35 км/ч постоянного ветра или 50 км/ч порывов — уже
     * неприятные условия для тренировки и переноски снаряжения.
     */
    if (maxWindSpeed >= 45 || maxWindGust >= 65) {
        return "очень сильный ветер";
    }

    if (maxWindSpeed >= 30 || maxWindGust >= 45) {
        return "сильный ветер";
    }

    if (maxWindSpeed >= 20 || maxWindGust >= 35) {
        return "ветрено";
    }

    return "";
}

function hasAnyCode(codeSet, expectedCodes) {
    return expectedCodes.some((code) => {
        return codeSet.has(code);
    });
}

function average(values) {
    if (!values.length) {
        return 0;
    }

    return sum(values) / values.length;
}

function sum(values) {
    return values.reduce((total, value) => {
        return total + value;
    }, 0);
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