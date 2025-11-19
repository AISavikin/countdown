// ===== КОНСТАНТЫ И НАСТРОЙКИ =====
const CONFIG = {
    UPDATE_INTERVAL: 100,
    QUOTE_CHANGE_INTERVAL: 5000,
    CACHE_KEYS: {
        EXPEDITION_DATA: 'expeditionData',
        OPTIMISTIC_MODE: 'optimisticMode'
    },
    // Минимальная продолжительность экспедиции (1 час)
    MIN_EXPEDITION_DURATION: 60 * 60 * 1000
};

const QUOTES = [
    "Как хочется домой...",
    "Скорее бы домой!",
    "Ещё немного...",
    "Уже скоро приплывём?",
    "Я скучаю по домашней еде",
    "Ветер, дуй в паруса!",
    "Домой, милый дом!",
    "Ещё пару волн и мы дома!",
    "Море красивое, но дома лучше",
    "Считаем чайки до дома",
    "Скоро горячий чай и диван!",
    "Мысль о доме согревает в плавании",
    "Ещё немного и я дома!",
    "Паруса наполняются попутным ветром!",
    "Вижу землю на горизонте! (нет)"
];

// ===== СОСТОЯНИЕ ПРИЛОЖЕНИЯ =====
const AppState = {
    currentQuoteIndex: 0,
    isOptimisticMode: false,
    lastUpdate: 0,
    expeditionData: null
};

// ===== DOM ЭЛЕМЕНТЫ =====
const DOM = {
    dataInputPanel: document.getElementById('data-input-panel'),
    countdownInterface: document.getElementById('countdown-interface'),
    toggle: document.getElementById('mode-toggle'),
    modeLabel: document.getElementById('mode-label'),
    errorMessage: document.getElementById('error-message'),
    expeditionForm: document.getElementById('expedition-form'),
    startDateInput: document.getElementById('start-date'),
    endDateInput: document.getElementById('end-date'),
    resetDataBtn: document.getElementById('reset-data'),
    optimisticModal: document.getElementById('optimistic-modal'),
    modalOptimisticDate: document.getElementById('modal-optimistic-date'),
    modalSaveBtn: document.getElementById('modal-save'),
    modalCancelBtn: document.getElementById('modal-cancel'),
    settingsButton: document.getElementById('settings-button'),
    settingsModal: document.getElementById('settings-modal'),
    settingsForm: document.getElementById('settings-form'),
    settingsStartDate: document.getElementById('settings-start-date'),
    settingsEndDate: document.getElementById('settings-end-date'),
    settingsOptimisticDate: document.getElementById('settings-optimistic-date'),
    settingsSaveBtn: document.getElementById('settings-save'),
    settingsCancelBtn: document.getElementById('settings-cancel'),
    settingsErrorMessage: document.getElementById('settings-error-message'),
    pwaInstallContainer: document.getElementById('pwa-install-container'),
    pwaInstallBtn: document.getElementById('pwa-install-btn')

};

// ===== URL ПАРАМЕТРЫ =====

/**
 * Парсит параметры из URL
 * @returns {Object|null} Объект с данными или null при ошибке
 */
function parseURLParameters() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        
        const startDate = urlParams.get('start');
        const endDate = urlParams.get('end');
        const optimisticDate = urlParams.get('optimistic');
        
        // Если нет обязательных параметров
        if (!startDate || !endDate) {
            return null;
        }
        
        return {
            start_date: startDate,
            end_date: endDate,
            optimistic_end_date: optimisticDate || null
        };
    } catch (error) {
        console.error('Ошибка парсинга URL параметров:', error);
        return null;
    }
}

/**
 * Проверяет валидность даты из URL параметра
 * @param {string} dateString - Строка с датой
 * @returns {boolean} true если дата валидна
 */
function isValidURLDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
        return false;
    }
    
    const date = new Date(dateString);
    
    // Проверяем что дата валидна и содержит время
    const isValid = !isNaN(date.getTime()) && 
                   dateString.includes('T') && 
                   dateString.includes(':');
    
    if (!isValid) {
        console.warn('Невалидная дата из URL:', dateString, 'Ожидается формат: YYYY-MM-DDTHH:mm:ss');
    }
    
    return isValid;
}

/**
 * Валидирует данные из URL параметров
 * @param {Object} data - Данные из URL
 * @returns {Object} Результат валидации {isValid: boolean, error?: string}
 */
function validateURLData(data) {
    // Проверяем обязательные поля
    if (!data.start_date || !data.end_date) {
        return {
            isValid: false,
            error: 'Отсутствуют обязательные параметры start и end'
        };
    }
    
    // Проверяем формат дат
    if (!isValidURLDate(data.start_date)) {
        return {
            isValid: false,
            error: 'Неверный формат даты начала. Используйте: YYYY-MM-DDTHH:mm:ss'
        };
    }
    
    if (!isValidURLDate(data.end_date)) {
        return {
            isValid: false,
            error: 'Неверный формат даты окончания. Используйте: YYYY-MM-DDTHH:mm:ss'
        };
    }
    
    // Преобразуем в timestamp для сравнения
    const startTimestamp = new Date(data.start_date).getTime();
    const endTimestamp = new Date(data.end_date).getTime();
    const now = Date.now();
    
    // Проверяем логику дат
    if (endTimestamp <= startTimestamp) {
        return {
            isValid: false,
            error: 'Дата окончания должна быть позже даты начала'
        };
    }
    
    if (endTimestamp <= now) {
        return {
            isValid: false,
            error: 'Дата окончания должна быть в будущем'
        };
    }
    
    // Проверяем минимальную продолжительность
    if (endTimestamp - startTimestamp < CONFIG.MIN_EXPEDITION_DURATION) {
        return {
            isValid: false,
            error: 'Продолжительность экспедиции должна быть не менее 1 часа'
        };
    }
    
    // Валидируем оптимистичную дату если указана
    if (data.optimistic_end_date) {
        if (!isValidURLDate(data.optimistic_end_date)) {
            return {
                isValid: false,
                error: 'Неверный формат оптимистичной даты. Используйте: YYYY-MM-DDTHH:mm:ss'
            };
        }
        
        const optimisticTimestamp = new Date(data.optimistic_end_date).getTime();
        
        if (optimisticTimestamp <= startTimestamp) {
            return {
                isValid: false,
                error: 'Оптимистичная дата должна быть позже даты начала'
            };
        }
        
        if (optimisticTimestamp >= endTimestamp) {
            return {
                isValid: false,
                error: 'Оптимистичная дата должна быть раньше даты окончания'
            };
        }
        
        if (optimisticTimestamp <= now) {
            return {
                isValid: false,
                error: 'Оптимистичная дата должна быть в будущем'
            };
        }
    }
    
    return { isValid: true };
}

/**
 * Загружает данные из URL параметров
 * @returns {Object|null} Данные экспедиции или null
 */
function loadDataFromURL() {
    const urlData = parseURLParameters();
    
    if (!urlData) {
        console.log('URL параметры отсутствуют или неполны');
        return null;
    }
    
    const validation = validateURLData(urlData);
    
    if (!validation.isValid) {
        console.warn('Невалидные данные из URL:', validation.error);
        showError(`Ошибка в URL параметрах: ${validation.error}. Используются другие данные.`);
        return null;
    }
    
    console.log('Успешно загружены данные из URL параметров:', urlData);
    return urlData;
}

/**
 * Очищает URL от параметров (после успешной загрузки)
 */
function cleanURLParameters() {
    const cleanURL = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanURL);
}

// ===== СЛУЖЕБНЫЕ ФУНКЦИИ =====

/**
 * Показывает сообщение об ошибке
 */
/**
 * Показывает сообщение об ошибке
 */
function showError(message, isHumorous = false) {
    // ОБНОВЛЕНИЕ: Безопасная проверка элемента
    if (DOM.errorMessage && DOM.errorMessage.parentNode) {
        DOM.errorMessage.textContent = message;
        DOM.errorMessage.style.display = 'block';
        
        if (isHumorous) {
            DOM.errorMessage.classList.add('humorous');
        } else {
            DOM.errorMessage.classList.remove('humorous');
        }
        
        setTimeout(() => {
            if (DOM.errorMessage && DOM.errorMessage.parentNode) {
                DOM.errorMessage.style.display = 'none';
                DOM.errorMessage.classList.remove('humorous');
            }
        }, 5000);
    }
    console.error("Ошибка приложения:", message);
}

/**
 * Проверяет валидность timestamp даты
 */
function isValidDate(timestamp) {
    return !isNaN(timestamp) && timestamp > 0;
}

/**
 * Анимирует изменение числового значения
 */
function animateNumberChange(element, newValue) {
    if (!element) return;
    
    if (element.textContent !== newValue) {
        element.classList.add('changing');
        setTimeout(() => element.classList.remove('changing'), 300);
    }
    element.textContent = newValue;
}

/**
 * Показывает следующую цитату с плавным переходом
 */
function showNextQuote() {
    const quoteElement = document.getElementById('quote');
    if (!quoteElement) return;

    quoteElement.style.opacity = '0';
    
    setTimeout(() => {
        AppState.currentQuoteIndex = (AppState.currentQuoteIndex + 1) % QUOTES.length;
        quoteElement.textContent = `"${QUOTES[AppState.currentQuoteIndex]}"`;
        quoteElement.style.opacity = '1';
    }, 500);
}

// ===== УПРАВЛЕНИЕ ДАННЫМИ ЭКСПЕДИЦИИ =====

/**
 * Загружает данные экспедиции из localStorage
 */
function loadExpeditionData() {
    try {
        const savedData = localStorage.getItem(CONFIG.CACHE_KEYS.EXPEDITION_DATA);
        if (!savedData) return false;

        AppState.expeditionData = JSON.parse(savedData);
        
        // Загружаем сохраненный режим оптимиста
        const savedMode = localStorage.getItem(CONFIG.CACHE_KEYS.OPTIMISTIC_MODE);
        AppState.isOptimisticMode = savedMode === 'true';

        showCountdownInterface();
        return true;
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        resetExpeditionData();
        return false;
    }
}

/**
 * Сохраняет данные экспедиции в localStorage
 */
function saveExpeditionData(data) {
    AppState.expeditionData = data;
    localStorage.setItem(CONFIG.CACHE_KEYS.EXPEDITION_DATA, JSON.stringify(data));
    showCountdownInterface();
}

/**
 * Сбрасывает все данные экспедиции
 */
function resetExpeditionData() {
    AppState.expeditionData = null;
    AppState.isOptimisticMode = false;
    
    localStorage.removeItem(CONFIG.CACHE_KEYS.EXPEDITION_DATA);
    localStorage.removeItem(CONFIG.CACHE_KEYS.OPTIMISTIC_MODE);
    
    // ОБНОВЛЕНИЕ: Сбрасываем состояние переключателя
    if (DOM.toggle) {
        DOM.toggle.checked = false;
    }
    
    showDataInputPanel();
}

// ===== УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ =====

/**
 * Показывает панель ввода данных
 */
function showDataInputPanel() {
    DOM.dataInputPanel.style.display = 'block';
    DOM.countdownInterface.style.display = 'none';
    
    // Устанавливаем значения по умолчанию
    const now = new Date();
    const nowString = now.toISOString().slice(0, 16);
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekLaterString = weekLater.toISOString().slice(0, 16);
    
    DOM.startDateInput.value = nowString;
    DOM.endDateInput.value = weekLaterString;
}

/**
 * Показывает интерфейс обратного отсчета
 */
function showCountdownInterface() {
    DOM.dataInputPanel.style.display = 'none';
    DOM.countdownInterface.style.display = 'block';
    
    initModeToggle();
    updateCountdown();
}

// ===== ОБРАБОТКА ФОРМЫ =====

/**
 * Валидирует введенные даты
 */
function validateDates(startDate, endDate, optimisticDate = null) {
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    
    if (endTimestamp <= startTimestamp) {
        throw new Error('Дата окончания должна быть позже даты начала');
    }
    
    if (optimisticDate) {
        const optimisticTimestamp = new Date(optimisticDate).getTime();
        
        if (optimisticTimestamp <= startTimestamp) {
            throw new Error('Оптимистичная дата должна быть позже даты начала');
        }
        
        if (optimisticTimestamp >= endTimestamp) {
            throw new Error('Оптимистичная дата должна быть раньше даты окончания');
        }
    }
    
    return true;
}

/**
 * Обрабатывает отправку формы ввода данных
 */
function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = {
        startDate: DOM.startDateInput.value,
        endDate: DOM.endDateInput.value,
    };
    
    try {
        // Проверяем обязательные поля
        if (!formData.startDate || !formData.endDate) {
            throw new Error('Пожалуйста, заполните обязательные поля');
        }
        
        // Валидируем даты
        validateDates(formData.startDate, formData.endDate);
        
        // Сохраняем данные
        const expeditionData = {
            start_date: formData.startDate.replace('T', ' ') + ':00',
            end_date: formData.endDate.replace('T', ' ') + ':00'
        };
        
        saveExpeditionData(expeditionData);
        
    } catch (error) {
        showError(error.message);
    }
}

/**
 * Переключает видимость поля оптимистичной даты в форме
 */
function toggleOptimisticDateField() {
    const isVisible = DOM.optimisticDateGroup.style.display === 'block';
    
    if (!isVisible) {
        DOM.optimisticDateGroup.style.display = 'block';
        DOM.toggleOptimisticBtn.textContent = 'Скрыть оптимистичную дату';
        
        // Автозаполняем серединой периода
        if (DOM.startDateInput.value && DOM.endDateInput.value) {
            const start = new Date(DOM.startDateInput.value).getTime();
            const end = new Date(DOM.endDateInput.value).getTime();
            const middle = new Date((start + end) / 2);
            DOM.optimisticDateInput.value = middle.toISOString().slice(0, 16);
        }
    } else {
        DOM.optimisticDateGroup.style.display = 'none';
        DOM.toggleOptimisticBtn.textContent = 'Добавить оптимистичную дату';
        DOM.optimisticDateInput.value = '';
    }
}

// ===== УПРАВЛЕНИЕ РЕЖИМАМИ =====

/**
 * Инициализирует переключатель режима оптимиста
 */
function initModeToggle() {
    const toggleContainer = document.getElementById('toggle-container');
    
    // ОБНОВЛЕНИЕ: Переинициализируем DOM ссылки
    DOM.toggle = document.getElementById('mode-toggle');
    DOM.modeLabel = document.getElementById('mode-label');
    
    if (!AppState.expeditionData || !DOM.toggle) {
        toggleContainer?.classList.add('hidden');
        return;
    }
    
    toggleContainer?.classList.remove('hidden');
    DOM.toggle.checked = AppState.isOptimisticMode;
    updateModeDisplay();
    
    // Настраиваем обработчики событий
    setupToggleHandlers();
}

/**
 * Настраивает обработчики для переключателя
 */
function setupToggleHandlers() {
    if (!DOM.toggle) return;
    
    // ОБНОВЛЕНИЕ: Безопасное обновление обработчиков без замены узлов
    DOM.toggle.removeEventListener('change', handleModeToggle);
    DOM.toggle.removeEventListener('keydown', handleToggleKeydown);
    
    DOM.toggle.addEventListener('change', handleModeToggle);
    DOM.toggle.addEventListener('keydown', handleToggleKeydown);
}

/**
 * Обрабатывает переключение режима
 */
function handleModeToggle(event) {
    const isChecked = event.target.checked;
    
    // Если включаем оптимистичный режим без даты - запрашиваем её
    if (isChecked && !AppState.expeditionData.optimistic_end_date) {
        showOptimisticDateModal();
        event.target.checked = false; // Временно оставляем выключенным
        return;
    }
    
    AppState.isOptimisticMode = isChecked;
    localStorage.setItem(CONFIG.CACHE_KEYS.OPTIMISTIC_MODE, isChecked);
    
    updateModeDisplay();
    updateCountdown();
}

/**
 * Обрабатывает клавиатурные события для переключателя
 */
function handleToggleKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        DOM.toggle.checked = !DOM.toggle.checked;
        DOM.toggle.dispatchEvent(new Event('change'));
    }
}

/**
 * Обновляет отображение текущего режима
 */
function updateModeDisplay() {
    if (DOM.modeLabel) {
        DOM.modeLabel.textContent = AppState.isOptimisticMode ? 'Оптимист' : 'Реалист';
    }
}

// ===== МОДАЛЬНОЕ ОКНО ОПТИМИСТИЧНОЙ ДАТЫ =====
/**
 * Показывает модальное окно для ввода оптимистичной даты
 */
function showOptimisticDateModal() {
    // Устанавливаем значение по умолчанию (середина периода)
    const start = new Date(AppState.expeditionData.start_date).getTime();
    const end = new Date(AppState.expeditionData.end_date).getTime();
    const middle = new Date((start + end) / 2);
    
    DOM.modalOptimisticDate.value = middle.toISOString().slice(0, 16);
    
    // Скрываем возможные предыдущие ошибки
    hideModalError();
    
    DOM.optimisticModal.style.display = 'flex';
}

/**
 * Показывает ошибку в модальном окне
 */
function showModalError(message, isHumorous = false) {
    const modalErrorMessage = document.getElementById('modal-error-message');
    if (modalErrorMessage) {
        modalErrorMessage.textContent = message;
        modalErrorMessage.style.display = 'block';
        
        if (isHumorous) {
            modalErrorMessage.classList.add('humorous');
        } else {
            modalErrorMessage.classList.remove('humorous');
        }
    }
}

/**
 * Скрывает ошибку в модальном окне
 */
function hideModalError() {
    const modalErrorMessage = document.getElementById('modal-error-message');
    if (modalErrorMessage) {
        modalErrorMessage.style.display = 'none';
        modalErrorMessage.classList.remove('humorous');
    }
}

/**
 * Обрабатывает сохранение оптимистичной даты из модального окна
 */
function handleModalSave() {
    try {
        const optimisticDate = DOM.modalOptimisticDate.value;
        
        if (!optimisticDate) {
            showModalError('Пожалуйста, укажите оптимистичную дату');
            return;
        }
        
        // Преобразуем в timestamp для сравнения
        const optimisticTimestamp = new Date(optimisticDate).getTime();
        const startTimestamp = new Date(AppState.expeditionData.start_date).getTime();
        const endTimestamp = new Date(AppState.expeditionData.end_date).getTime();
        
        // Проверяем что дата валидна
        if (isNaN(optimisticTimestamp)) {
            showModalError('Неверный формат даты');
            return;
        }
        
        // Юмористическая валидация с разными сообщениями (теперь внутри модального окна)
        if (optimisticTimestamp <= startTimestamp) {
            showModalError('Да совсем не пойти в этот рейс было бы хорошо, но не сложилось...', true);
            return;
        }
        
        if (optimisticTimestamp >= endTimestamp) {
            showModalError('Странный у тебя оптимизм, хочешь вернуться позже?', true);
            return;
        }
        
        // Если дата в прошлом (но после начала)
        const now = Date.now();
        if (optimisticTimestamp <= now) {
            showModalError('Оптимизм - это хорошо, но в прошлое вернуться нельзя!', true);
            return;
        }
        
        // Обновляем данные
        AppState.expeditionData.optimistic_end_date = optimisticDate.replace('T', ' ') + ':00';
        localStorage.setItem(
            CONFIG.CACHE_KEYS.EXPEDITION_DATA,
            JSON.stringify(AppState.expeditionData)
        );
        
        // Включаем оптимистичный режим
        AppState.isOptimisticMode = true;
        localStorage.setItem(CONFIG.CACHE_KEYS.OPTIMISTIC_MODE, 'true');
        
        DOM.toggle.checked = true;
        updateModeDisplay();
        updateCountdown();
        hideOptimisticDateModal();
        
    } catch (error) {
        showModalError(error.message);
    }
}

/**
 * Скрывает модальное окно
 */
function hideOptimisticDateModal() {
    hideModalError(); // Скрываем ошибки при закрытии
    DOM.optimisticModal.style.display = 'none';
}

/**
 * Обрабатывает отмену в модальном окне
 */
function handleModalCancel() {
    AppState.isOptimisticMode = false;
    hideOptimisticDateModal();
}

// ===== ОСНОВНОЙ ОБРАТНЫЙ ОТСЧЕТ =====

/**
 * Вычисляет временные параметры экспедиции
 */
function calculateExpeditionTiming() {
    const startDate = new Date(AppState.expeditionData.start_date).getTime();
    const realisticEndDate = new Date(AppState.expeditionData.end_date).getTime();
    const optimisticEndDate = AppState.expeditionData.optimistic_end_date 
        ? new Date(AppState.expeditionData.optimistic_end_date).getTime() 
        : null;
    
    const hasOptimisticDate = optimisticEndDate && isValidDate(optimisticEndDate);
    const targetDate = (hasOptimisticDate && AppState.isOptimisticMode) 
        ? optimisticEndDate 
        : realisticEndDate;
    
    const currentTime = Date.now();
    const totalDuration = targetDate - startDate;
    const timePassed = currentTime - startDate;
    const timeLeft = targetDate - currentTime;
    
    return { startDate, targetDate, totalDuration, timePassed, timeLeft };
}

/**
 * Обновляет прогресс-бар экспедиции
 */
function updateProgressBar(progressPercent) {
    const progressFill = document.getElementById('progress-fill');
    const progressShip = document.getElementById('progress-ship');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.querySelector('.progress-bar');
    
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressShip) progressShip.style.left = `${progressPercent}%`;
    if (progressText) progressText.textContent = `Пройдено: ${Math.round(progressPercent)}%`;
    if (progressBar) progressBar.setAttribute('aria-valuenow', Math.round(progressPercent));
}

/**
 * Обновляет предупреждение о скором завершении
 */
function updateWarningIndicator(timeLeft) {
    const container = document.querySelector('.container');
    const shouldWarn = timeLeft < 24 * 60 * 60 * 1000; // Меньше суток
    
    if (shouldWarn) {
        container.classList.add('warning');
    } else {
        container.classList.remove('warning');
    }
}

/**
 * Форматирует время в читаемые компоненты
 */
function formatTimeComponents(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const remainingSeconds = seconds % 60;
    
    return { days, hours, minutes, seconds: remainingSeconds };
}

/**
 * Обновляет отображение прошедшего времени экспедиции
 */
function updateDurationDisplay(timePassed) {
    const { days, hours, minutes, seconds } = formatTimeComponents(timePassed);
    
    animateNumberChange(document.getElementById('duration-days'), days.toString().padStart(2, '0'));
    animateNumberChange(document.getElementById('duration-hours'), hours.toString().padStart(2, '0'));
    animateNumberChange(document.getElementById('duration-minutes'), minutes.toString().padStart(2, '0'));
    animateNumberChange(document.getElementById('duration-seconds'), seconds.toString().padStart(2, '0'));
}

/**
 * Обновляет основной отсчет времени
 */
function updateCountdownDisplay(timeLeft) {
    const { days, hours, minutes, seconds } = formatTimeComponents(timeLeft);
    
    animateNumberChange(document.getElementById('days'), days.toString().padStart(2, '0'));
    animateNumberChange(document.getElementById('hours'), hours.toString().padStart(2, '0'));
    animateNumberChange(document.getElementById('minutes'), minutes.toString().padStart(2, '0'));
    animateNumberChange(document.getElementById('seconds'), seconds.toString().padStart(2, '0'));
}

/**
 * Обрабатывает завершение экспедиции
 */
function handleExpeditionComplete() {
    if (!AppState.expeditionData) return;
    
    const hasOptimisticDate = AppState.expeditionData.optimistic_end_date;
    const message = (hasOptimisticDate && AppState.isOptimisticMode)
        ? "Рейс завершен! Оптимизм помог вернуться раньше! ⛵🏠"
        : "Рейс завершен! Добро пожаловать домой! ⛵🏠";
    
    const container = document.querySelector('.container');
    if (!container) return;
    
    container.innerHTML = `
        <h1 style="color: #6cff87;">${message}</h1>
        <div class="quote">"Наконец-то на суше!"</div>
        <div class="progress-container">
            <div class="progress-labels">
                <span>🚩 Старт</span>
                <span>🏁 Финиш</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 100%"></div>
                <div class="progress-ship" style="left: 100%">⛵</div>
            </div>
            <div class="progress-text">Пройдено: 100%</div>
        </div>
        <div class="reset-container">
            <button id="reset-complete" class="reset-btn">Начать заново</button>
        </div>
    `;
    
    container.classList.add('expedition-complete');
    
    // ОБНОВЛЕНИЕ: Безопасная повторная привязка обработчика
    const resetCompleteBtn = document.getElementById('reset-complete');
    if (resetCompleteBtn) {
        resetCompleteBtn.addEventListener('click', resetExpeditionData);
    }
}

/**
 * Основная функция обновления обратного отсчета
 */
function updateCountdown() {
    if (!AppState.expeditionData) return;
    
    // Оптимизация частоты обновления
    const now = Date.now();
    if (now - AppState.lastUpdate < CONFIG.UPDATE_INTERVAL) return;
    AppState.lastUpdate = now;
    
    try {
        const { startDate, targetDate, totalDuration, timePassed, timeLeft } = calculateExpeditionTiming();
        
        // Проверяем валидность дат
        if (!isValidDate(startDate) || !isValidDate(targetDate) || targetDate <= startDate) {
            showError("Неверные даты экспедиции");
            return;
        }
        
        // Рассчитываем прогресс
        let progressPercent = (timePassed / totalDuration) * 100;
        progressPercent = Math.max(0, Math.min(100, progressPercent));
        
        // Обновляем интерфейс
        updateProgressBar(progressPercent);
        updateWarningIndicator(timeLeft);
        updateDurationDisplay(timePassed);
        
        // Проверяем завершение экспедиции
        if (timeLeft <= 0) {
            handleExpeditionComplete();
            return;
        }
        
        updateCountdownDisplay(timeLeft);
        
    } catch (error) {
        console.error('Ошибка при обновлении отсчета:', error);
        showError('Произошла ошибка при обновлении отсчета');
    }
}

// ===== PWA УСТАНОВКА =====
let deferredPrompt;

// Сохраняем событие установки
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Показываем кнопку установки если приложение еще не установлено
    if (DOM.pwaInstallContainer) {
        DOM.pwaInstallContainer.style.display = 'block';
    }
});

// Проверяем, установлено ли уже приложение
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (DOM.pwaInstallContainer) {
        DOM.pwaInstallContainer.style.display = 'none';
    }
    console.log('PWA установлено');
});

// ===== ФУНКЦИИ ДЛЯ НАСТРОЕК =====

/**
 * Показывает ошибку в модальном окне настроек
 */
function showSettingsError(message) {
    if (DOM.settingsErrorMessage) {
        DOM.settingsErrorMessage.textContent = message;
        DOM.settingsErrorMessage.style.display = 'block';
        
        setTimeout(() => {
            DOM.settingsErrorMessage.style.display = 'none';
        }, 5000);
    }
}

/**
 * Показывает модальное окно настроек
 */
function showSettingsModal() {
    if (!AppState.expeditionData) return;
    
    // Заполняем форму текущими данными
    const startDate = AppState.expeditionData.start_date.replace(' ', 'T').slice(0, 16);
    const endDate = AppState.expeditionData.end_date.replace(' ', 'T').slice(0, 16);
    
    DOM.settingsStartDate.value = startDate;
    DOM.settingsEndDate.value = endDate;
    
    if (AppState.expeditionData.optimistic_end_date) {
        const optimisticDate = AppState.expeditionData.optimistic_end_date.replace(' ', 'T').slice(0, 16);
        DOM.settingsOptimisticDate.value = optimisticDate;
    } else {
        DOM.settingsOptimisticDate.value = '';
    }
    
    // Скрываем предыдущие ошибки
    DOM.settingsErrorMessage.style.display = 'none';
    
    DOM.settingsModal.style.display = 'flex';
}

/**
 * Скрывает модальное окно настроек
 */
function hideSettingsModal() {
    DOM.settingsModal.style.display = 'none';
}

/**
 * Обрабатывает сохранение настроек
 */
function handleSettingsSave() {
    try {
        const formData = {
            startDate: DOM.settingsStartDate.value,
            endDate: DOM.settingsEndDate.value,
            optimisticDate: DOM.settingsOptimisticDate.value || null
        };
        
        // Проверяем обязательные поля
        if (!formData.startDate || !formData.endDate) {
            throw new Error('Пожалуйста, заполните обязательные поля');
        }
        
        // Валидируем даты
        validateDates(formData.startDate, formData.endDate, formData.optimisticDate);
        
        // Обновляем данные
        const updatedExpeditionData = {
            start_date: formData.startDate.replace('T', ' ') + ':00',
            end_date: formData.endDate.replace('T', ' ') + ':00'
        };
        
        if (formData.optimisticDate) {
            updatedExpeditionData.optimistic_end_date = formData.optimisticDate.replace('T', ' ') + ':00';
        }
        
        // Сохраняем обновленные данные
        AppState.expeditionData = updatedExpeditionData;
        localStorage.setItem(
            CONFIG.CACHE_KEYS.EXPEDITION_DATA,
            JSON.stringify(updatedExpeditionData)
        );
        
        // Обновляем интерфейс
        updateCountdown();
        hideSettingsModal();
        
    } catch (error) {
        showSettingsError(error.message);
    }
}

/**
 * Обрабатывает установку PWA
 */
function handlePWAInstall() {
    if (!deferredPrompt) {
        showSettingsError('Приложение уже установлено или установка недоступна');
        return;
    }
    
    deferredPrompt.prompt();
    
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('Пользователь принял установку PWA');
        } else {
            console.log('Пользователь отклонил установку PWA');
        }
        deferredPrompt = null;
    });
}

// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====

/**
 * Инициализирует обработчики событий
 */
function initializeEventHandlers() {
    // Форма ввода данных
    DOM.expeditionForm.addEventListener('submit', handleFormSubmit);
    DOM.resetDataBtn.addEventListener('click', resetExpeditionData);
    
    // Модальное окно
    DOM.modalSaveBtn.addEventListener('click', handleModalSave);
    DOM.modalCancelBtn.addEventListener('click', handleModalCancel);
    
    // ОБРАБОТЧИКИ ДЛЯ НАСТРОЕК
    DOM.settingsButton.addEventListener('click', showSettingsModal);
    DOM.settingsSaveBtn.addEventListener('click', handleSettingsSave);
    DOM.settingsCancelBtn.addEventListener('click', hideSettingsModal);
    DOM.pwaInstallBtn.addEventListener('click', handlePWAInstall);
    

    // Закрытие модального окна по клику вне его
    DOM.optimisticModal.addEventListener('click', (event) => {
        if (event.target === DOM.optimisticModal) {
            handleModalCancel();
        }
    });

    DOM.settingsModal.addEventListener('click', (event) => {
        if (event.target === DOM.settingsModal) {
            hideSettingsModal();
        }
    });
}

/**
 * Инициализирует PWA функциональность
 */
function initializePWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('ServiceWorker зарегистрирован:', registration.scope);
            })
            .catch((error) => {
                console.log('Ошибка регистрации ServiceWorker:', error);
            });
    }
}

/**
 * Запускает периодические обновления
 */
function startIntervals() {
    setInterval(updateCountdown, 1000);
    setInterval(showNextQuote, CONFIG.QUOTE_CHANGE_INTERVAL);
}

/**
 * Основная функция инициализации приложения
 */
function initializeApp() {
    initializePWA();
    initializeEventHandlers();
    
    // ОБНОВЛЕНИЕ: Убедимся, что DOM элементы загружены перед использованием
    setTimeout(() => {
        // НОВАЯ ЛОГИКА: Приоритеты загрузки данных
        // 1. Пробуем загрузить из URL параметров
        const urlData = loadDataFromURL();
        if (urlData) {
            console.log('Используются данные из URL параметров');
            saveExpeditionData(urlData);
            cleanURLParameters(); // Очищаем URL после успешной загрузки
        } 
        // 2. Если нет URL параметров, пробуем localStorage
        else if (!loadExpeditionData()) {
            // 3. Если нет данных, показываем форму ввода
            console.log('Данные не найдены, показываем форму ввода');
            showDataInputPanel();
        }
        
        startIntervals();
        console.log('Приложение обратного отсчета инициализировано');
    }, 100);
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
document.addEventListener('DOMContentLoaded', initializeApp);