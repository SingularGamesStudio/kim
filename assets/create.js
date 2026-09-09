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
            Для создания тренировки откройте
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
                training.weather =
                    await fetchWeather(training);

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

    const params = new URLSearchParams({
        latitude: String(training.venue.lat),
        longitude: String(training.venue.lng),
        hourly:
            "temperature_2m,precipitation_probability,precipitation",
        timezone: "Europe/Moscow",
        forecast_days: "16"
    });

    const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`
    );

    if (!response.ok) {
        return "Прогноз погоды уточняется.";
    }

    const data = await response.json();

    const hours = [-2, -1, 0, 1, 2].map((offset) => {
        return new Date(
            start.getTime() + offset * 60 * 60 * 1000
        );
    });

    const indexes = hours
        .map(moscowHourIndex)
        .map((time) => data.hourly.time.indexOf(time))
        .filter((index) => index >= 0);

    if (!indexes.length) {
        return "Прогноз погоды уточняется.";
    }

    const temperatures = indexes.map((index) => {
        return data.hourly.temperature_2m[index];
    });

    const probabilities = indexes.map((index) => {
        return data.hourly.precipitation_probability[index];
    });

    const precipitation = indexes.map((index) => {
        return data.hourly.precipitation[index];
    });

    const temperature = Math.round(
        temperatures.reduce((a, b) => a + b, 0) /
        temperatures.length
    );

    const probability = Math.max(...probabilities);
    const amount = precipitation.reduce(
        (sum, value) => sum + value,
        0
    );

    const sign = temperature > 0 ? "+" : "";

    let rainText = "без существенных осадков";

    if (probability >= 60 || amount >= 1) {
        rainText =
            `осадки вероятны до ${probability}%` +
            `, около ${amount.toFixed(1)} мм`;
    } else if (probability >= 30) {
        rainText =
            `небольшая вероятность осадков: до ${probability}%`;
    }

    return `Прогноз: ${sign}${temperature}°C, ${rainText}.`;
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

    result.innerHTML = `
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
    const isVote = training.types.length > 1;

    const title = isVote
        ? "Фехтовальная тренировка"
        : `${training.types[0]} тренировка`;

    const typeText = isVote
        ? `${training.types.join(" или ")} — зависит от количества участников.\n`
        : "";

    return `${title} ${fmtDate(training.date)}.
${typeText}
Начало в ${training.time} у ${training.deployment.name} (зелёный крестик), место тренировки — ${training.venue.name} (красный крестик) на карте.
Если опаздываете до 20:30, сначала подходите к ${training.deployment.name} помогать таскать снаряжение.
Кворум ${training.quorum} человек, хотя бы один из которых ключник. Отсечка за 2 часа до тренировки, ждём ваши + в комментариях.
${training.weather}
Берите с собой перчатки для защиты рук от мозолей и не только.
Техника безопасности:
${C.SAFETY_URL}
И расписаться за инструктаж на тренировке.

Запись: ${url}`;
}