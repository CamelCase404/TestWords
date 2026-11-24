// ==========================================================================
// FILE: leaderboard.js — ИНТЕЛЛЕКТУАЛЬНАЯ СИСТЕМА ЛОКАЛЬНЫХ РЕКОРДОВ
// ==========================================================================

const STORAGE_KEY = "ege_ortho_highscores";

// Инициализация таблицы лидеров при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    displayLeaderboard();
});

// Сохранение нового рекорда в локальную базу данных
function saveScoreToLeaderboard(score, rangeFrom, rangeTo) {
    if (score === undefined || score === null) return;

    let leaderboard = getLeaderboardData();

    // Формируем объект записи
    const newEntry = {
        score: parseInt(score, 10),
        date: getCurrentFormattedDate(),
        range: `${rangeFrom.toUpperCase()}—${rangeTo.toUpperCase()}`,
    };

    // Добавляем новую запись, сортируем по убыванию баллов и оставляем топ-5
    leaderboard.push(newEntry);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(leaderboard));
    displayLeaderboard();
}

// Получение данных из localStorage
function getLeaderboardData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Отображение таблицы на главной странице
// Отображение таблицы на главной странице (Числовой рейтинг без медалей)
function displayLeaderboard() {
    const container = document.getElementById("leaderboard-container");
    if (!container) return;

    const data = getLeaderboardData();

    if (data.length === 0) {
        container.innerHTML = `
            <div style="font-size: 13px; color: var(--text-muted); font-style: italic; padding: 4px 0;">
                История прохождений пуста. Пройдите первый тест, чтобы зафиксировать рекорд!
            </div>
        `;
        return;
    }

    let html = `
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px;">
    `;

    data.forEach((entry, index) => {
        // Заменено на строгий числовой формат по вашему запросу
        const positionNumber = `${index + 1}. `;

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid var(--border-light); padding: 10px 14px; border-radius: 6px; font-size: 14px;">
                <div style="font-weight: 500; color: var(--text-main);">
                    <span style="color: var(--text-muted); font-weight: 700; margin-right: 4px;">${positionNumber}</span>
                    <span style="font-weight: 700;">${entry.score}</span> баллов
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">
                    Диапазон: ${entry.range} • <span style="font-size: 11px;">${entry.date}</span>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// Полная очистка таблицы лидеров
function clearLeaderboard() {
    if (confirm("Вы действительно хотите удалить все сохраненные рекорды?")) {
        localStorage.removeItem(STORAGE_KEY);
        displayLeaderboard();
    }
}

// Хелпер получения красивой даты (ДД.ММ.ГГГГ)
function getCurrentFormattedDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}
