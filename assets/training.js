let training = null;
let signups = [];
let trainingMap = null;

document.addEventListener("DOMContentLoaded", async () => {
    const trainingId = new URLSearchParams(
        window.location.search
    ).get("id");

    if (!trainingId) {
        document.querySelector("#training").innerHTML = `
            <p class="error-state">
                В ссылке нет ID тренировки.
            </p>
        `;

        return;
    }

    initializeSafetyBanner();

    try {
        const response = await publicGetWithRetry({
            action: "getTraining",
            id: trainingId
        });

        training = response.training;
        signups = Array.isArray(response.signups)
            ? response.signups
            : [];

        renderTraining();
        renderSignups();
        initializeSignupForm(trainingId);
    } catch (error) {
        console.error(error);

        document.querySelector("#training").innerHTML = `
            <p class="error-state">
                Не удалось загрузить тренировку.

                <br><br>

                <small>
                    ${esc(error.message)}
                </small>
            </p>
        `;
    }
});

function initializeSafetyBanner() {
    const safety = document.querySelector("#safety");
    const closeButton = document.querySelector("#hide-safety");

    if (!safety || !closeButton) {
        return;
    }

    if (localStorage.getItem("safetyDismissed") === "1") {
        safety.remove();

        return;
    }

    closeButton.addEventListener("click", () => {
        localStorage.setItem("safetyDismissed", "1");

        safety.remove();
    });
}

function renderTraining() {
    const trainingElement = document.querySelector("#training");

    const title =
        training.types.join(" / ") ||
        "Неопределённая тренировка";

    const deploymentName = training.deployment.name;
    const venueName = training.venue.name;

    trainingElement.innerHTML = `
        <p class="eyebrow">Анонс тренировки</p>

        <h1>${esc(title)}</h1>

        <p class="training-date">
            ${esc(fmtDate(training.date))}
            <span class="date-separator">·</span>
            начало в ${esc(training.time)}
        </p>

        ${
            training.comment
                ? `
                    <p class="training-comment">
                        ${esc(training.comment)}
                    </p>
                `
                : ""
        }

        <div class="training-facts">
            <div class="fact">
                <span class="fact-label">
                    Сбор и деплой
                </span>

                <strong>
                    ${esc(deploymentName)}
                    <span class="marker-note marker-green">
                        (зелёный крестик)
                    </span>
                </strong>
            </div>

            <div class="fact">
                <span class="fact-label">
                    Место тренировки
                </span>

                <strong>
                    ${esc(venueName)}
                    <span class="marker-note marker-red">
                        (красный крестик)
                    </span>
                </strong>
            </div>

            <div class="fact">
                <span class="fact-label">
                    Кворум
                </span>

                <strong>
                    ${training.quorum} чел.
                </strong>
            </div>
        </div>

        <div class="training-notes">
            <p>
                Отсечка — за 2 часа до начала.
                Если опаздываете до ${esc(
                    addMinutes(training.time, 30)
                )}, сначала подойдите к
                ${esc(placeTo(training.deployment.name))}.
            </p>

            ${
                training.weather
                    ? `
                        <p class="weather-line">
                            ${esc(training.weather)}
                        </p>
                    `
                    : ""
            }
        </div>

        <details class="training-guidance">
            <summary>
                Что взять и что прочитать
            </summary>

            <div class="training-guidance-content">
                <p>
                    Берите с собой перчатки для защиты рук от мозолей и не только.
                </p>

                <p>
                    Для допуска к занятиям необходимо прочитать
                    <a
                        target="_blank"
                        rel="noopener"
                        href="${esc(C.SAFETY_URL)}"
                    >
                        краткую инструкцию по технике безопасности
                    </a>
                    и расписаться за инструктаж на тренировке.
                </p>

                <p>
                    Вопросы по инструкции и запрос полной версии ТБ можно
                    задавать в сообщения группы или в чате тренировок.
                </p>
            </div>
        </details>
    `;

    document
        .querySelector("#signup-section")
        .classList.remove("hidden");

    document
        .querySelector("#entries-section")
        .classList.remove("hidden");

    renderVotingOptions();
    showDeferredMapLoader();
    scheduleMapRender();
}

function showDeferredMapLoader() {
    const mapSection = document.querySelector("#map-section");
    const mapLoader = document.querySelector("#map-loader");
    const mapStatus = document.querySelector("#map-status");


    if (!mapSection || !mapLoader || !mapStatus) {
        return;
    }


    mapSection.classList.remove("hidden");
    mapLoader.classList.remove("hidden");


    mapStatus.textContent = "Загружаем карту…";
}


/*
 * Два кадра нужны, чтобы браузер гарантированно успел:
 * 1. применить DOM-изменения;
 * 2. показать тренировку, форму, комментарии и спиннер карты;
 * 3. только потом начать тяжёлую инициализацию OpenLayers.
 */
function scheduleMapRender() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                renderMap();
            }, 0);
        });
    });
}

function renderMap() {
    const mapElement = document.querySelector("#map");
    const mapLoader = document.querySelector("#map-loader");
    const mapStatus = document.querySelector("#map-status");


    if (!mapElement || !window.ol) {
        console.warn(
            "OpenLayers не загружен: карта не будет показана."
        );


        if (mapLoader) {
            mapLoader.classList.add("hidden");
        }


        if (mapStatus) {
            mapStatus.textContent = "Не удалось загрузить карту.";
        }


        return;
    }


    mapElement.classList.remove("hidden");


    if (trainingMap) {
        trainingMap.setTarget(undefined);
        trainingMap = null;
    }


    const deploymentFeature = createMapMarker(
        training.deployment,
        "deployment"
    );


    const venueFeature = createMapMarker(
        training.venue,
        "venue"
    );


    const vectorLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [
                deploymentFeature,
                venueFeature
            ]
        }),


        style: mapMarkerStyle
    });


    const osmSource = new ol.source.OSM();


    const deploymentCoordinate = ol.proj.fromLonLat([
        training.deployment.lng,
        training.deployment.lat
    ]);


    const venueCoordinate = ol.proj.fromLonLat([
        training.venue.lng,
        training.venue.lat
    ]);


    trainingMap = new ol.Map({
        target: mapElement,


        layers: [
            new ol.layer.Tile({
                source: osmSource
            }),


            vectorLayer
        ],


        view: new ol.View({
            center: deploymentCoordinate,
            zoom: 16
        })
    });


    const extent = ol.extent.boundingExtent([
        deploymentCoordinate,
        venueCoordinate
    ]);


    trainingMap.getView().fit(extent, {
        padding: [70, 70, 70, 70],
        maxZoom: 17,
        duration: 0
    });


    /*
     * rendercomplete приходит, когда OpenLayers закончил
     * текущий рендер и загрузку нужных тайлов.
     */
    trainingMap.once("rendercomplete", () => {
        if (mapLoader) {
            mapLoader.classList.add("hidden");
        }


        if (mapStatus) {
            mapStatus.textContent = "Карта загружена.";
        }
    });


    osmSource.on("tileloaderror", () => {
        if (mapStatus) {
            mapStatus.textContent =
                "Часть карты не удалось загрузить.";
        }
    });
}

function createMapMarker(location, kind) {
    return new ol.Feature({
        geometry: new ol.geom.Point(
            ol.proj.fromLonLat([
                location.lng,
                location.lat
            ])
        ),

        kind
    });
}

function mapMarkerStyle(feature) {
    const isDeployment =
        feature.get("kind") === "deployment";

    const color = isDeployment
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

function renderVotingOptions() {
    const voteOptions = document.querySelector(
        "#vote-options"
    );

    if (!voteOptions) {
        return;
    }

    if (training.types.length <= 1) {
        voteOptions.innerHTML = "";

        return;
    }

    const options = [
        ...training.types,
        "Тык"
    ];

    voteOptions.innerHTML = `
        <fieldset class="vote-fieldset">
            <legend>
                Что проведём?
            </legend>

            <div class="vote-choice-grid">
                ${options
                    .map((option) => {
                        const label =
                            option === "Тык"
                                ? "Тык"
                                : option;

                        return `
                            <label class="vote-choice">
                                <input
                                    required
                                    type="radio"
                                    name="choice"
                                    value="${esc(option)}"
                                >

                                <span>
                                    ${esc(label)}
                                </span>
                            </label>
                        `;
                    })
                    .join("")}
            </div>
        </fieldset>
    `;
}

function initializeSignupForm(trainingId) {
    const form = document.querySelector("#signup-form");

    const nameInput = document.querySelector("#name");

    const commentInput = document.querySelector(
        "#signup-comment"
    );

    const message = document.querySelector(
        "#signup-message"
    );

    if (!form || !nameInput || !commentInput) {
        return;
    }

    nameInput.value =
        localStorage.getItem("fencingSignupName") || "";

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const websiteValue = document.querySelector(
            "#website"
        ).value;

        if (websiteValue) {
            return;
        }

        const name = nameInput.value.trim();

        const comment =
            commentInput.value.trim() || "+";

        const selectedChoice = document.querySelector(
            '[name="choice"]:checked'
        );

        const choice = selectedChoice
            ? selectedChoice.value
            : "";

        if (!name) {
            message.textContent =
                "Введите имя или позывной.";

            nameInput.focus();

            return;
        }

        const submitButton = form.querySelector(
            '[type="submit"]'
        );

        localStorage.setItem(
            "fencingSignupName",
            name
        );

        submitButton.disabled = true;
        message.textContent = "Отправляем запись…";

        try {
            /*
             * publicPost — отправка в скрытый iframe.
             * Ответ прочитать нельзя из-за cross-origin,
             * поэтому далее ждём появления своей записи
             * через JSONP polling.
             */
            await publicPost({
                action: "signup",
                trainingId,
                name,
                comment,
                choice,
                website: websiteValue
            });

            message.textContent =
                "Запись отправлена. Обновляем список…";

            const refreshed =
                await waitForSubmittedSignup({
                    trainingId,
                    name,
                    comment
                });

            signups = Array.isArray(refreshed.signups)
                ? refreshed.signups
                : [];

            renderSignups();

            commentInput.value = "";

            message.textContent =
                "Готово: вы записаны.";
        } catch (error) {
            console.error(error);

            message.textContent =
                `Не удалось подтвердить запись: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    });
}

async function waitForSubmittedSignup({
    trainingId,
    name,
    comment
}) {
    const maxAttempts = 10;
    const retryDelayMs = 900;

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt += 1
    ) {
        const response = await publicGetWithRetry({
            action: "getTraining",
            id: trainingId
        });

        const fetchedSignups =
            response.signups || [];

        const submittedRecordExists =
            fetchedSignups.some((signup) => {
                const sameName =
                    normalizeName(signup.name) ===
                    normalizeName(name);

                const sameComment =
                    String(signup.comment || "+") ===
                    String(comment || "+");

                return sameName && sameComment;
            });

        if (submittedRecordExists) {
            return response;
        }

        if (attempt < maxAttempts) {
            await sleep(retryDelayMs);
        }
    }

    throw new Error(
        "Запись не появилась в списке за 9 секунд."
    );
}

function renderSignups() {
    const relevantSignups = Array.isArray(signups)
        ? signups
        : [];

    renderParticipantCount(relevantSignups);
    renderVoteResults(relevantSignups);
    renderEntries(relevantSignups);
}

function renderParticipantCount(relevantSignups) {
    const countElement = document.querySelector(
        "#participant-count"
    );

    if (!countElement) {
        return;
    }

    const uniqueNames = new Set(
        relevantSignups
            .map((signup) => {
                return normalizeName(signup.name);
            })
            .filter(Boolean)
    );

    const count = uniqueNames.size;

    const word = declension(
        count,
        "участник",
        "участника",
        "участников"
    );

    countElement.textContent =
        `· ${count} ${word}`;
}

function renderVoteResults(relevantSignups) {
    const container = document.querySelector(
        "#vote-results"
    );

    if (!container) {
        return;
    }

    if (training.types.length <= 1) {
        container.innerHTML = "";

        return;
    }

    /*
     * Один голос на имя:
     * побеждает последняя запись с выбранным вариантом.
     */
    const latestChoiceByName = new Map();

    for (const signup of relevantSignups) {
        const normalizedName = normalizeName(
            signup.name
        );

        if (!normalizedName || !signup.choice) {
            continue;
        }

        latestChoiceByName.set(
            normalizedName,
            signup.choice
        );
    }

    const choices = [
        ...training.types,
        "Тык"
    ];

    const counts = Object.fromEntries(
        choices.map((choice) => [choice, 0])
    );

    for (const choice of latestChoiceByName.values()) {
        if (Object.hasOwn(counts, choice)) {
            counts[choice] += 1;
        }
    }

    container.innerHTML = choices
        .map((choice) => {
            const label =
                choice === "Тык"
                    ? "Тык"
                    : choice;

            return `
                <div class="vote-result-card">
                    <span class="vote-result-label">
                        ${esc(label)}
                    </span>

                    <strong class="vote-result-count">
                        ${counts[choice]}
                    </strong>
                </div>
            `;
        })
        .join("");
}

function renderEntries(relevantSignups) {
    const entriesElement = document.querySelector(
        "#entries"
    );

    if (!entriesElement) {
        return;
    }

    /*
     * Map сохраняет порядок первого появления имени.
     * Поэтому комментарии одного человека группируются
     * после его первого комментария.
     */
    const groupedByName = new Map();

    for (const signup of relevantSignups) {
        const normalizedName = normalizeName(
            signup.name
        );

        if (!normalizedName) {
            continue;
        }

        if (!groupedByName.has(normalizedName)) {
            groupedByName.set(normalizedName, []);
        }

        groupedByName
            .get(normalizedName)
            .push(signup);
    }

    if (!groupedByName.size) {
        entriesElement.innerHTML = `
            <p class="empty-state">
                Пока никто не записался.
            </p>
        `;

        return;
    }

    entriesElement.innerHTML = [
        ...groupedByName.values()
    ]
        .map((personEntries) => {
            const first = personEntries[0];

            const comments = personEntries
                .map((signup) => {
                    const isPlus =
                        String(signup.comment || "+")
                            .trim() === "+";

                    return `
                        <div class="entry-comment">
                            <span class="entry-comment-text ${
                                isPlus ? "entry-plus" : ""
                            }">
                                ${esc(signup.comment || "+")}
                            </span>

                            <time>
                                ${esc(
                                    formatSignupTime(
                                        signup.submittedAt
                                    )
                                )}
                            </time>
                        </div>
                    `;
                })
                .join("");

            return `
                <article class="participant-entry">
                    <div class="participant-name">
                        ${esc(first.name)}
                    </div>

                    <div class="participant-comments">
                        ${comments}
                    </div>
                </article>
            `;
        })
        .join("");
}

function normalizeName(name) {
    return String(name || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("ru-RU");
}

function formatSignupTime(isoDate) {
    const date = new Date(isoDate);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function declension(number, one, few, many) {
    const mod100 = number % 100;
    const mod10 = number % 10;

    if (mod100 >= 11 && mod100 <= 14) {
        return many;
    }

    if (mod10 === 1) {
        return one;
    }

    if (mod10 >= 2 && mod10 <= 4) {
        return few;
    }

    return many;
}

function normalizePlaceName(place) {
    return String(place || "")
        .trim()
        .toLocaleLowerCase("ru-RU")
        .replaceAll("ё", "е");
}

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