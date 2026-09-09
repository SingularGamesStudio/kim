document.addEventListener("DOMContentLoaded", () => {
    const createButton = document.querySelector(
        "#create-training-button"
    );

    const state = document.querySelector("#admin-state");

    loadPublicTrainingList();

    createButton.addEventListener("click", async () => {
        createButton.disabled = true;

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

                return `
                    <a class="training-card" href="${href}">
                        <div>
                            <p class="card-date">
                                ${esc(fmtDate(training.date))}
                                ·
                                ${esc(training.time)}
                            </p>

                            <h3>${esc(title)}</h3>

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