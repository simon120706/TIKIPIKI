# Тики Пики

Современная учебная социальная сеть на **HTML5 + CSS3 + Vanilla JavaScript ES6 Modules + Firebase**. Проект не использует React/Vue/Angular и подходит для публикации на GitHub Pages.

## Возможности

- Firebase Authentication: регистрация, вход, выход, восстановление пароля.
- Firestore: пользователи, посты, комментарии, лайки, подписки, сохранённые посты.
- CRUD публикаций: создание и удаление владельцем; редактирование можно расширить тем же модальным редактором.
- Лайки с уникальным документом `postId_userId` и транзакцией.
- Комментарии в реальном времени через `onSnapshot()`.
- Поиск по тексту и имени автора с debounce и Firestore prefix-range queries.
- Фильтрация по тегам.
- Пагинация ленты через `limit()` + `startAfter()`.
- Профили, подписки, сохранённые публикации.
- Роли `user` / `admin`.
- Админ-dashboard, пользователи, публикации и комментарии.
- Firestore Security Rules.
- Адаптивный desktop/tablet/mobile UI.
- GitHub Pages friendly: нет серверного Node.js backend.

## Структура

```text
tiki-piki/
├── index.html
├── login.html
├── profile.html
├── post.html
├── create.html
├── admin.html
├── saved.html
├── search.html
├── firebase.rules
├── README.md
├── css/
│   ├── style.css
│   ├── auth.css
│   └── responsive.css
└── js/
    ├── firebase.js
    ├── auth.js
    ├── app.js
    ├── ui.js
    ├── posts.js
    ├── comments.js
    ├── profile.js
    ├── search.js
    ├── admin.js
    └── utils.js
```

## 1. Создание Firebase проекта

1. Открой Firebase Console.
2. Создай новый проект.
3. В проекте выбери **Authentication → Sign-in method**.
4. Включи **Email/Password**.
5. Создай **Firestore Database** в нужном режиме.
6. Добавь Web App в настройках проекта.
7. Скопируй выданный `firebaseConfig`.

## 2. Подключение Firebase config

Открой:

```text
js/firebase.js
```

и замени только placeholder-значения:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Не публикуй приватные серверные ключи. Web Firebase config сам по себе не является секретом; безопасность обеспечивают Authentication и Firestore Rules.

## 3. Security Rules

Содержимое `firebase.rules` нужно установить в:

**Firebase Console → Firestore Database → Rules**

Нажми Publish.

Правила запрещают полностью открытый `allow read, write: if true;`. Роль администратора читается из `users/{uid}.role`. Счётчики социальных действий защищены от произвольного изменения; транзакции проверяются через `getAfter()` / `existsAfter()`.

## 4. Создание admin

Самый простой учебный способ:

1. Зарегистрируй обычного пользователя через приложение.
2. Открой Firestore.
3. Найди `users/{uid}` этого пользователя.
4. Измени `role` с `user` на `admin`.
5. Перезайди в приложение.

После этого появится пункт **Админ-панель**.

> Важное ограничение браузерного Firebase-приложения: удаление документа `users/{uid}` не удаляет Firebase Authentication account. Полное удаление Auth-пользователя безопасно делать через Firebase Admin SDK/Cloud Functions, но это уже отдельный backend и не требуется для GitHub Pages версии.

## 5. Запуск локально

Не открывай HTML двойным кликом через `file://`.

Используй любой статический сервер. Например, VS Code + Live Server.

Либо Python:

```bash
python -m http.server 5500
```

После запуска открой:

```text
http://localhost:5500
```

## 6. GitHub Pages

1. Создай GitHub repository.
2. Загрузи содержимое этой папки в repository.
3. Открой **Settings → Pages**.
4. В качестве Source выбери GitHub Actions или Deploy from a branch.
5. Если выбран branch, укажи `main` и `/root`.
6. Открой опубликованный URL.

Так как приложение состоит из статических HTML/CSS/JS файлов и использует Firebase SDK по CDN, отдельный сервер не нужен.

## Firestore коллекции

### users/{userId}

```js
{
  id,
  name,
  email,
  avatar,
  bio,
  role,
  followersCount,
  followingCount,
  createdAt
}
```

### posts/{postId}

```js
{
  id,
  authorId,
  authorName,
  authorAvatar,
  text,
  image,
  likesCount,
  commentsCount,
  createdAt,
  tags,
  category,
  textLower,
  authorNameLower
}
```

`textLower` и `authorNameLower` — технические поля для prefix search.

### comments/{commentId}

```js
{
  postId,
  authorId,
  authorName,
  authorAvatar,
  text,
  createdAt
}
```

### likes/{postId_userId}

```js
{
  postId,
  userId,
  createdAt
}
```

### follows/{followerId_followingId}

```js
{
  followerId,
  followingId,
  createdAt
}
```

### savedPosts/{userId_postId}

```js
{
  userId,
  postId,
  createdAt
}
```

## Firestore indexes

Firestore автоматически создаёт single-field indexes. Для запросов ленты с `tags array-contains + createdAt orderBy` Firebase может предложить composite index после первого такого запроса. Если Console покажет ссылку **Create index**, открой её и создай индекс.

Для комментариев нужен индекс:

```text
comments
postId      Ascending
createdAt   Ascending
```

Для savedPosts:

```text
savedPosts
userId      Ascending
createdAt   Descending
```

Для профиля:

```text
posts
authorId    Ascending
createdAt   Descending
```

## Важная деталь поиска

Firestore не является полнотекстовым поисковиком. В этой учебной версии поиск реализован как **prefix search**: например, `trav` найдёт тексты/имена, начинающиеся с `trav`.

Если позже понадобится настоящий полнотекстовый поиск по произвольным словам, можно подключить Algolia, Typesense или другой поисковый сервис, но это уже будет дополнительная внешняя инфраструктура.

## Архитектурные решения

- `firebase.js` — только инициализация Firebase.
- `auth.js` — Authentication и guard страниц.
- `posts.js` — публикации, лайки, подписки, saved posts и pagination.
- `comments.js` — real-time comments.
- `profile.js` — профили.
- `search.js` — поиск.
- `admin.js` — админские операции.
- `ui.js` — reusable UI, карточки, toast, modal, icons.
- `utils.js` — мелкие чистые функции.
- `app.js` — shell, навигация и feed.

## Примечание про изображения

Сейчас поле `image` принимает HTTPS URL. Это специально соответствует условию первой рабочей версии. Для Firebase Storage позже можно заменить форму загрузки и функцию создания поста, не меняя модель Firestore и карточки.

## Проверка требований

- [x] Firebase Authentication
- [x] Firestore
- [x] Security Rules
- [x] Vanilla JS ES6 modules
- [x] Регистрация / логин / logout / reset password
- [x] users/{uid}
- [x] CRUD-путь публикаций
- [x] Лайки
- [x] Комментарии
- [x] onSnapshot
- [x] Поиск + debounce
- [x] Фильтрация
- [x] limit + startAfter pagination
- [x] Профили
- [x] Follow/unfollow
- [x] Saved posts
- [x] Admin role
- [x] Admin dashboard
- [x] Модерация постов и комментариев
- [x] Responsive UI
- [x] GitHub Pages
