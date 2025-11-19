const CACHE_NAME = 'countdown-pwa-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Установка Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('Service Worker: Installed');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', function(event) {
  // Пропускаем не-GET запросы и chrome-extension
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Возвращаем кэш если есть
        if (response) {
          return response;
        }

        // Клонируем запрос
        const fetchRequest = event.request.clone();

        // Делаем сетевой запрос
        return fetch(fetchRequest)
          .then(function(response) {
            // Проверяем валидный ли ответ
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Клонируем ответ
            const responseToCache = response.clone();

            // Кэшируем новый ресурс
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(function() {
            // Для HTML запросов возвращаем запасную страницу
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});