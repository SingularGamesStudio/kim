import { $, errorBlock, render, setStatus } from '../core/dom.js';
import { listTrainings } from '../data/trainings.js';
import { trainingCard } from '../views/training-card.js';
import { requestToken } from '../core/auth.js';

const list = $('#training-list');

function renderList(trainings) {
    render(
        list,
        trainings.length
            ? trainings.map(trainingCard).join('')
            : '<p class="empty-state">Пока нет опубликованных тренировок.</p>',
    );
}

async function loadList() {
    try {
        renderList(await listTrainings({ onFresh: renderList }));
    } catch (error) {
        console.error(error);

        render(
            list,
            errorBlock(
                'Не удалось загрузить список тренировок. Попробуйте обновить страницу.',
                error.message,
            ),
        );
    }
}

/**
 * Единственное место, где открывается OAuth popup: он должен быть вызван
 * прямо из обработчика клика, иначе браузер его заблокирует.
 * Права проверит уже create.html — первым же чтением закрытой таблицы.
 */
function initAdminButton() {
    const button = $('#create-training-button');
    const state = $('#admin-state');

    button?.addEventListener('click', async () => {
        button.disabled = true;

        setStatus(state, 'Открываем вход через Google…');

        try {
            await requestToken();

            location.href = 'create.html';
        } catch (error) {
            console.error(error);

            setStatus(state, 'Не удалось войти через Google.', true);

            button.disabled = false;
        }
    });
}

initAdminButton();
loadList();
