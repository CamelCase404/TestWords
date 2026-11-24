// ==========================================================================
// FILE: app.js — ЧАСТЬ 1: УПРАВЛЕНИЕ СЕССИЕЙ И ДИНАМИЧЕСКИЕ ТАЙМЕРЫ
// ==========================================================================

let currentWords = [];
let currentIndex = 0;
let pointsScore = 0;
let badAttempts = 0; // Счётчик жизней (обнуляется жестко при старте)
let errorsTracker = [];
let analyticsTracker = [];

let stageTimer = null;
let timelineInterval = null;
const MAX_STAGE_TIME = 10; // Строго 10 секунд на один раунд
let msRemaining = MAX_STAGE_TIME * 1000;
let timeSpentOnWord = 0;

// Графический рендеринг векторных SVG-сердец
function renderLives() {
    const container = document.getElementById("lives-container");
    if (!container) return;
    container.innerHTML = "";

    for (let i = 0; i < 3; i++) {
        const heartWrapper = document.createElement("div");
        heartWrapper.style.display = "inline-block";
        heartWrapper.style.lineHeight = "0";

        let isLost = i < badAttempts;

        heartWrapper.innerHTML = `
            <svg class="heart-svg ${isLost ? "lost" : ""}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
        `;
        container.appendChild(heartWrapper);
    }
}

// Генерация сессии с жестким обнулением параметров
function generateSession() {
    let fromLetter =
        document.getElementById("filter-from").value.trim().toLowerCase() ||
        "а";
    let toLetter =
        document.getElementById("filter-to").value.trim().toLowerCase() || "я";
    let priorityLetter = document
        .getElementById("filter-priority")
        .value.trim()
        .toLowerCase();
    const priorityType = document.getElementById("filter-type").value;

    let startCode = fromLetter.charCodeAt(0);
    let endCode = toLetter.charCodeAt(0);

    if (startCode > endCode) {
        let temp = startCode;
        startCode = endCode;
        endCode = temp;
    }

    // Безопасное чтение глобального массива слов из внешнего файла words.js
    let filtered = dictionary.filter((item) => {
        let itemCode = String(item.letter || "")
            .toLowerCase()
            .charCodeAt(0);
        return itemCode >= startCode && itemCode <= endCode;
    });

    if (priorityType !== "any") {
        filtered = filtered.filter((item) => item.category === priorityType);
    }

    if (filtered.length === 0) {
        alert("По заданным критериям слов не найдено. Запущена общая сессия.");
        filtered = [...dictionary];
    }

    let priorityWords = [];
    let otherWords = [];

    if (priorityLetter && priorityLetter.length === 1) {
        priorityWords = filtered.filter(
            (item) => String(item.letter).toLowerCase() === priorityLetter,
        );
        otherWords = filtered.filter(
            (item) => String(item.letter).toLowerCase() !== priorityLetter,
        );

        priorityWords.sort(() => 0.5 - Math.random());
        otherWords.sort(() => 0.5 - Math.random());

        currentWords = [...priorityWords, ...otherWords].slice(0, 10);
    } else {
        currentWords = filtered.sort(() => 0.5 - Math.random()).slice(0, 10);
    }

    // СБРОС И ОЧИСТКА ВСЕХ СЧЕТЧИКОВ (Убирает баг перетекания проигрышей)
    currentIndex = 0;
    pointsScore = 0;
    badAttempts = 0;
    errorsTracker = [];
    analyticsTracker = [];

    // Гарантированное сокрытие окон во избежание багов наложения экрана
    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("result-screen").classList.add("hidden");
    document.getElementById("feedback-modal").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");

    initPointerEngine();
    loadStage();
}

function backToMenu() {
    deleteActiveIntervals();
    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("result-screen").classList.add("hidden");
    document.getElementById("feedback-modal").classList.add("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
}

function loadStage() {
    if (badAttempts >= 3) {
        endGameSession(false);
        return;
    }

    clearInterval(stageTimer);
    clearInterval(timelineInterval);

    msRemaining = MAX_STAGE_TIME * 1000;
    timeSpentOnWord = 0;

    renderLives();
    document.getElementById("score-points").innerText = pointsScore;

    const currentItem = currentWords[currentIndex];

    const wordCard = document.getElementById("draggable-word");
    wordCard.innerText = currentItem.mask;
    wordCard.style.transform = "translate3d(0px, 0px, 0px)";

    document.getElementById("context-display").innerText =
        `Контекст: ${currentItem.context}`;

    const randomizedOptions = [...currentItem.options].sort(
        () => 0.5 - Math.random(),
    );
    randomizedOptions.forEach((opt, idx) => {
        document.getElementById(`zone-${idx}`).innerText = opt;
    });

    document.getElementById("feedback-modal").classList.add("hidden");

    const timelineIndicator = document.getElementById("timeline-indicator");
    timelineIndicator.style.transform = "scaleX(1)";

    timelineInterval = setInterval(() => {
        msRemaining -= 100;
        timeSpentOnWord += 0.1;

        let ratio = msRemaining / (MAX_STAGE_TIME * 1000);
        if (ratio < 0) ratio = 0;
        timelineIndicator.style.transform = `scaleX(${ratio})`;

        if (msRemaining <= 0) {
            clearInterval(timelineInterval);
            evaluateDropChoice(null);
        }
    }, 100);
}
// ==========================================================================
// FILE: app.js — ЧАСТЬ 2: POINTER-ДВИЖОК, БАЛЛЫ И ИТОГОВАЯ АНАЛИТИКА
// ==========================================================================

function initPointerEngine() {
    const oldCard = document.getElementById("draggable-word");
    oldCard.replaceWith(oldCard.cloneNode(true));
    const card = document.getElementById("draggable-word");
    let isDragging = false;
    let startX = 0,
        startY = 0;

    card.onpointerdown = null; // Полная зачистка старых событий

    card.addEventListener("pointerdown", (e) => {
        if (
            !document
                .getElementById("feedback-modal")
                .classList.contains("hidden")
        )
            return;

        isDragging = true;
        card.classList.add("dragging");
        card.setPointerCapture(e.pointerId);

        startX = e.clientX;
        startY = e.clientY;
    });

    card.addEventListener("pointermove", (e) => {
        if (!isDragging) return;

        const currentX = e.clientX - startX;
        const currentY = e.clientY - startY;

        card.style.transform = `translate3d(${currentX}px, ${currentY}px, 0px)`;
        checkActiveHoverZones(e.clientX, e.clientY);
    });

    card.addEventListener("pointerup", (e) => {
        if (!isDragging) return;
        isDragging = false;
        card.classList.remove("dragging");
        card.releasePointerCapture(e.pointerId);

        const dropZoneId = findDroppedZone(e.clientX, e.clientY);
        document
            .querySelectorAll(".drop-zone")
            .forEach((z) => z.classList.remove("active-hover"));

        if (dropZoneId !== null) {
            const chosenText = document.getElementById(dropZoneId).innerText;
            evaluateDropChoice(chosenText);
        } else {
            card.style.transform = "translate3d(0px, 0px, 0px)";
        }
    });
}

function checkActiveHoverZones(clientX, clientY) {
    document.querySelectorAll(".drop-zone").forEach((zone) => {
        const rect = zone.getBoundingClientRect();
        if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        ) {
            zone.classList.add("active-hover");
        } else {
            zone.classList.remove("active-hover");
        }
    });
}

function findDroppedZone(clientX, clientY) {
    let targetedId = null;
    document.querySelectorAll(".drop-zone").forEach((zone) => {
        const rect = zone.getBoundingClientRect();
        if (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
        ) {
            targetedId = zone.id;
        }
    });
    return targetedId;
}

function evaluateDropChoice(userSelection) {
    clearInterval(stageTimer);
    clearInterval(timelineInterval);

    document.getElementById("draggable-word").style.transform =
        "translate3d(0px, 0px, 0px)";

    const currentItem = currentWords[currentIndex];
    const statusModal = document.getElementById("modal-status");
    const textModal = document.getElementById("modal-text");
    const ruleModal = document.getElementById("modal-rule");
    const mainBox = document.getElementById("main-container");

    const isCorrect = userSelection === currentItem.correct;
    const finalTimeOnWord = parseFloat(timeSpentOnWord.toFixed(1));

    analyticsTracker.push({
        item: currentItem,
        timeSpent: finalTimeOnWord,
        wasWrong: !isCorrect,
    });

    if (isCorrect) {
        const secondsLeft = Math.max(0, Math.floor(msRemaining / 1000));
        const calculatedPoints = 10 + secondsLeft * 2;
        pointsScore += calculatedPoints;

        statusModal.innerText = "Правильно";
        statusModal.className = "status-correct";
        textModal.innerHTML = `Слово восстановлено: <strong>${currentItem.full}</strong>.<br>Время размышлений: ${finalTimeOnWord} сек. (+${calculatedPoints} баллов).`;
    } else {
        badAttempts++;
        errorsTracker.push(currentItem);

        mainBox.classList.add("shake");
        setTimeout(() => mainBox.classList.remove("shake"), 400);

        statusModal.innerText = userSelection ? "Неверно" : "Время истекло";
        statusModal.className = "status-wrong";
        textModal.innerHTML = `Правильный ответ: <strong>${currentItem.full}</strong> (орфограмма: <strong>${currentItem.correct}</strong>).<br>Время размышлений: ${finalTimeOnWord} сек.`;
    }

    ruleModal.innerText = `Правило: ${currentItem.rule}`;
    document.getElementById("feedback-modal").classList.remove("hidden");
    document.getElementById("next-btn").focus();
}

function deleteActiveIntervals() {
    clearInterval(stageTimer);
    clearInterval(timelineInterval);
}

function nextQuestion() {
    if (badAttempts >= 3) {
        endGameSession(false);
        return;
    }

    currentIndex++;
    if (currentIndex < currentWords.length) {
        loadStage();
    } else {
        endGameSession(true);
    }
}

function endGameSession(isVictory) {
    deleteActiveIntervals();

    // АВТОМАТИЧЕСКАЯ ФИКСАЦИЯ РЕКОРДА В LOCALSTORAGE ПРИ ЛЮБОМ ИСХОДЕ ТЕСТА
    const fromLetter =
        document.getElementById("filter-from").value.trim() || "а";
    const toLetter = document.getElementById("filter-to").value.trim() || "э";
    if (typeof saveScoreToLeaderboard === "function") {
        saveScoreToLeaderboard(pointsScore, fromLetter, toLetter);
    }

    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("result-screen").classList.remove("hidden");

    const finalTitle = document.getElementById("result-title");
    document.getElementById("final-points").innerText = pointsScore;

    if (isVictory && badAttempts < 3) {
        finalTitle.innerText = "Успешное прохождение";
    } else {
        finalTitle.innerText = "Тест прерван. Потрачены все 3 жизни!";
    }

    const analyticsContainer = document.getElementById("analytics-list");
    analyticsContainer.innerHTML = "";

    let triggerCount = 0;

    analyticsTracker.forEach((record) => {
        if (record.wasWrong) {
            triggerCount++;
            const block = document.createElement("div");
            block.className = "error-item";
            block.innerHTML = `<strong>ОШИБКА: ${record.item.full}</strong> (${record.item.context}).<br>
                               Верный ответ: <strong>${record.item.correct}</strong> • Затрачено времени: ${record.timeSpent} сек.<br>
                               <span style="color:var(--text-muted); font-size:1em;">ФАКТЫ: ${record.item.rule}</span>`;
            analyticsContainer.appendChild(block);
        }
    });

    analyticsTracker.forEach((record) => {
        if (!record.wasWrong && record.timeSpent >= 4.5) {
            triggerCount++;
            const block = document.createElement("div");
            block.className = "error-item";
            block.style.borderLeftColor = "var(--border-dark)";
            block.innerHTML = `⏱️ <strong>ЗАДЕРЖКА МЫШЛЕНИЯ: ${record.item.full}</strong> (${record.item.context}).<br>
                               Вы ответили верно, но думали слишком долго: <strong>${record.timeSpent} сек.</strong> (норма реакции до 4.5 сек).<br>
                               <span style="color:var(--text-muted); font-size:12px;">💡 ${record.item.rule}</span>`;
            analyticsContainer.appendChild(block);
        }
    });

    if (triggerCount === 0) {
        const block = document.createElement("div");
        block.className = "error-item";
        block.style.borderLeftColor = "var(--border-dark)";
        block.innerHTML = `✨ Идеальная сессия! Вы ответили мгновенно и без единой ошибки.`;
        analyticsContainer.appendChild(block);
    }
    document.getElementById("analytics-section").classList.remove("hidden");
}
