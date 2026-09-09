document.addEventListener("DOMContentLoaded", () => {
    const createButton = document.querySelector(
        "#create-training-button"
    );

    const state = document.querySelector("#admin-state");

    loadPublicTrainingList();

    createButton.addEventListener("click", async () => {
        createButton.disabled = true;

        state.classList.remove("status-error");

        state.textContent =
            "Открываем вход Google и проверяем права администратора…";

        try {
            /*
             * Это единственное место, где вызывается OAuth popup.
             * Token сохранится в sessionStorage, затем create.html
             * использует его без второго клика.
             */
            await googleToken();
            await requireAdmin();

            location.href = "create.html";
        } catch (error) {
            console.error(error);

            clearStoredAccessToken();

            state.textContent =
                "Не удалось войти или у аккаунта нет доступа к закрытой таблице.";
            state.classList.add("status-error");

            createButton.disabled = false;
        }
    });
});

async function loadPublicTrainingList() {
    const list = document.querySelector("#training-list");

    try {
        const response = await publicGetWithRetry({
            action: "listTrainings"
        });

        const trainings = response.trainings || [];

        if (!trainings.length) {
            list.innerHTML = `
                <p class="empty-state">
                    Пока нет опубликованных тренировок.
                </p>
            `;

            return;
        }

        list.innerHTML = trainings
            .map((training) => {
                const title =
                    training.types.join(" / ") ||
                    "Неопределённая тренировка";

                const href =
                    `training.html?id=${encodeURIComponent(training.id)}`;

                const dateLabel = shortTrainingDate(
                    training.date,
                    training.time
                );

                return `
                    <a class="training-card" href="${href}">
                        <div class="training-card-date">
                            ${esc(dateLabel)}
                        </div>

                        <div class="training-card-main">
                            <p class="card-type">
                                ${esc(title)}
                            </p>

                            <p class="card-meta">
                                ${esc(training.venue.name)}
                                · кворум ${training.quorum}
                            </p>
                        </div>

                        <span class="card-arrow">→</span>
                    </a>
                `;
            })
            .join("");
    } catch (error) {
        console.error(error);

        list.innerHTML = `
            <p class="error-state">
                Не удалось загрузить список тренировок.
                Попробуйте обновить страницу.
            </p>
        `;
    }
}

function shortTrainingDate(isoDate, time) {
    const date = new Date(
        `${isoDate}T12:00:00+03:00`
    );

    const weekday = new Intl.DateTimeFormat("ru-RU", {
        weekday: "short",
        timeZone: "Europe/Moscow"
    }).format(date);

    const dayMonth = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Moscow"
    }).format(date);

    return `${weekday}, ${dayMonth} · ${time}`;
}