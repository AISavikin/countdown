// service-worker.js
const APP_VERSION = '1.0.0';
const CACHE_NAME = `countdown-app-${APP_VERSION}`;
const MAX_CACHE_SIZE = 50;

const STATIC_CACHE_URLS = [
    './',
    './index.html',
    './app.js', 
    './style.css',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Обратный отсчет экспедиции</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 20px; 
            text-align: center; 
            background: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .container {
            max-width: 500px;
            width: 100%;
        }
        .offline-card {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            color: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        h1 { 
            font-size: 24px; 
            margin-bottom: 20px;
            color: #fff;
            text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        }
        .offline-message { 
            background: rgba(255, 107, 107, 0.8); 
            color: white; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        button { 
            background: rgba(76, 175, 80, 0.7); 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            cursor: pointer; 
            font-size: 16px;
            margin: 10px;
            transition: all 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        button:hover {
            background: rgba(76, 175, 80, 0.9);
            transform: translateY(-2px);
        }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s ease-in-out infinite;
            margin-right: 10px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .ship-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="offline-card">
            <div class="ship-icon">⛵</div>
            <h1>Обратный отсчет экспедиции</h1>
            <div class="offline-message">
                <p>🔌 Офлайн-режим</p>
                <p>Приложение загружается в ограниченном режиме.</p>
            </div>
            <p>Основные функции должны быть доступны после восстановления соединения.</p>
            <div>
                <button onclick="retryConnection()">
                    <span class="loading"></span>Повторить попытку
                </button>
                <button onclick="useOffline()">Продолжить офлайн</button>
            </div>
        </div>
    </div>
    <script>
        function retryConnection() {
            const btn = event.target.closest('button');
            btn.innerHTML = '<span class="loading"></span>Проверка связи...';
            btn.disabled = true;
            
            if (navigator.onLine) {
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                setTimeout(() => {
                    btn.innerHTML = '❌ Нет соединения';
                    setTimeout(() => {
                        btn.innerHTML = 'Повторить попытку';
                        btn.disabled = false;
                    }, 2000);
                }, 2000);
            }
        }
        
        function useOffline() {
            // Пытаемся загрузить основное приложение из кэша
            if ('caches' in window) {
                caches.match('./index.html')
                    .then(response => {
                        if (response) {
                            return response.text();
                        }
                        throw new Error('No cached version');
                    })
                    .then(html => {
                        document.open();
                        document.write(html);
                        document.close();
                    })
                    .catch(() => {
                        // Если нет кэша, остаемся на fallback странице
                        console.log('No cached version available');
                    });
            }
        }
        
        // Автоматическая перезагрузка при появлении сети
        if (navigator.onLine) {
            setTimeout(() => {
                location.reload();
            }, 3000);
        }
        
        window.addEventListener('online', () => {
            location.reload();
        });
    </script>
</body>
</html>`;

// Функция для очистки старых записей в кэше
async function cleanOldCache(cache, maxSize) {
    try {
        const requests = await cache.keys();
        if (requests.length > maxSize) {
            const requestsWithTime = await Promise.all(
                requests.map(async (request) => {
                    const response = await cache.match(request);
                    let timestamp = Date.now();
                    
                    if (response) {
                        const dateHeader = response.headers.get('date');
                        if (dateHeader) {
                            timestamp = new Date(dateHeader).getTime();
                        }
                    }
                    
                    return { request, timestamp };
                })
            );
            
            // Сортируем по времени (старые сначала)
            requestsWithTime.sort((a, b) => a.timestamp - b.timestamp);
            
            // Удаляем самые старые записи
            const toDelete = requestsWithTime.slice(0, requests.length - maxSize);
            await Promise.all(toDelete.map(item => cache.delete(item.request)));
            
            console.log(`Countdown SW: Cleared ${toDelete.length} old cache entries`);
        }
    } catch (error) {
        console.warn('Countdown SW: Cache cleaning failed:', error);
    }
}

// Обработка навигационных запросов
async function handleNavigateRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    
    try {
        // Сначала пробуем сеть с таймаутом
        const networkPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const response = await Promise.race([networkPromise, timeoutPromise]);
        
        // Если сетевой запрос успешен, обновляем кэш
        if (response && response.status === 200) {
            await cache.put(request, response.clone());
        }
        
        return response;
    } catch (networkError) {
        console.log('Countdown SW: Navigation network failed, trying cache...');
        
        // Пробуем кэш
        try {
            const cachedResponse = await cache.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // Если в кэше нет, пробуем альтернативные URL
            const fallbackUrls = ['./', './index.html', '/', '/index.html'];
            for (const url of fallbackUrls) {
                const fallbackResponse = await cache.match(url);
                if (fallbackResponse) {
                    console.log('Countdown SW: Serving fallback for navigation');
                    return fallbackResponse;
                }
            }
            
            // Если ничего нет, возвращаем fallback HTML
            console.log('Countdown SW: Serving offline fallback HTML');
            return new Response(FALLBACK_HTML, {
                headers: { 
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache'
                }
            });
        } catch (cacheError) {
            console.error('Countdown SW: Cache failed for navigation:', cacheError);
            
            // Аварийный fallback
            return new Response(FALLBACK_HTML, {
                headers: { 
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-cache'
                }
            });
        }
    }
}

// Обработка статических запросов
async function handleStaticRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    
    try {
        // Сначала пробуем кэш
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            // Проверяем свежесть кэша (не старше 1 дня для статики)
            const cachedTime = new Date(cachedResponse.headers.get('date') || Date.now());
            const cacheAge = Date.now() - cachedTime.getTime();
            const MAX_AGE = 24 * 60 * 60 * 1000; // 1 день
            
            if (cacheAge < MAX_AGE) {
                return cachedResponse;
            }
        }
        
        // Если нет в кэше или кэш устарел, пробуем сеть
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            // Клонируем response перед кэшированием
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            await cleanOldCache(cache, MAX_CACHE_SIZE);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Countdown SW: Static resource failed, using cache:', request.url);
        
        // Пробуем вернуть из кэша даже если он старый
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Для изображений возвращаем заглушку
        if (request.destination === 'image') {
            return new Response(
                '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#1a2980"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-family="Arial" font-size="10" fill="white">⛵</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
            );
        }
        
        // Для CSS возвращаем пустой стиль
        if (request.destination === 'style') {
            return new Response('/* Fallback CSS */', {
                headers: { 'Content-Type': 'text/css' }
            });
        }
        
        // Для JS возвращаем пустой скрипт
        if (request.destination === 'script') {
            return new Response('// Fallback JS', {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        // Для других ресурсов возвращаем ошибку
        return new Response('Service Unavailable', { 
            status: 503, 
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('Countdown SW: Installing version', APP_VERSION);
    
    // Принудительная активация нового SW
    self.skipWaiting();
    
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                console.log('Countdown SW: Caching static resources');
                
                // Кэшируем критические ресурсы с повторными попытками
                const criticalUrls = ['./', './index.html', './app.js', './style.css', './manifest.json'];
                
                for (const url of criticalUrls) {
                    let success = false;
                    for (let attempt = 0; attempt < 3 && !success; attempt++) {
                        try {
                            await cache.add(url);
                            success = true;
                            console.log(`Countdown SW: Cached ${url} (attempt ${attempt + 1})`);
                        } catch (error) {
                            console.warn(`Countdown SW: Failed to cache ${url}, attempt ${attempt + 1}:`, error);
                            if (attempt === 2) {
                                // На последней попытке создаем заглушку
                                const fallbackContent = url.endsWith('.js') ? '// Fallback JS' :
                                                       url.endsWith('.css') ? '/* Fallback CSS */' :
                                                       FALLBACK_HTML;
                                const fallbackResponse = new Response(fallbackContent, {
                                    headers: { 
                                        'Content-Type': url.endsWith('.js') ? 'application/javascript' :
                                                     url.endsWith('.css') ? 'text/css' : 'text/html'
                                    }
                                });
                                await cache.put(url, fallbackResponse);
                            }
                        }
                    }
                }
                
                console.log('Countdown SW: Installation completed');
            } catch (error) {
                console.error('Countdown SW: Installation failed:', error);
            }
        })()
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('Countdown SW: Activating version', APP_VERSION);
    
    event.waitUntil(
        (async () => {
            try {
                // Очищаем старые кэши
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName.startsWith('countdown-app-') && cacheName !== CACHE_NAME) {
                            console.log('Countdown SW: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
                
                console.log('Countdown SW: Activation completed');
                // Сообщаем всем клиентам о готовности
                await self.clients.claim();
                
                // Отправляем сообщение всем клиентам
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        version: APP_VERSION,
                        cacheName: CACHE_NAME
                    });
                });
            } catch (error) {
                console.error('Countdown SW: Activation failed:', error);
            }
        })()
    );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
    // Пропускаем не-GET запросы и chrome-extension
    if (event.request.method !== 'GET' || 
        event.request.url.startsWith('chrome-extension://') ||
        event.request.url.includes('browser-sync') ||
        event.request.url.includes('sockjs')) {
        return;
    }

    event.respondWith(
        (async () => {
            // Для навигационных запросов (страницы)
            if (event.request.mode === 'navigate') {
                return handleNavigateRequest(event.request);
            }
            
            // Для статических ресурсов
            return handleStaticRequest(event.request);
        })()
    );
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
    console.log('Countdown SW: Background sync:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        console.log('Countdown SW: Performing background sync');
        
        // Обновляем критические ресурсы
        const cache = await caches.open(CACHE_NAME);
        const urlsToUpdate = ['./', './index.html', './app.js', './style.css'];
        
        for (const url of urlsToUpdate) {
            try {
                const networkResponse = await fetch(url, {
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (networkResponse.status === 200) {
                    await cache.put(url, networkResponse.clone());
                    console.log(`Countdown SW: Updated ${url} in cache`);
                }
            } catch (error) {
                console.warn(`Countdown SW: Failed to update ${url}:`, error);
            }
        }
        
        // Уведомляем клиентов об обновлении
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_SYNC_COMPLETE',
                timestamp: new Date().toISOString()
            });
        });
    } catch (error) {
        console.error('Countdown SW: Background sync failed:', error);
    }
}

// Обработка сообщений от клиентов
self.addEventListener('message', (event) => {
    console.log('Countdown SW: Received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            type: 'VERSION_INFO',
            version: APP_VERSION,
            cacheName: CACHE_NAME,
            timestamp: new Date().toISOString()
        });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({
                type: 'CACHE_CLEARED',
                success: true
            });
        });
    }
});

// Глобальная обработка ошибок
self.addEventListener('error', (event) => {
    console.error('Countdown SW: Global error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Countdown SW: Unhandled promise rejection:', event.reason);
});