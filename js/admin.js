import { db } from "./firebase.js";
import { requireAuth } from "./auth.js";
import {
  showToast,
  confirmDialog,
  refreshIcons
} from "./ui.js";
import {
  escapeHtml,
  formatDate,
  initials
} from "./utils.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  getCountFromServer,
  increment
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";


const admin = await requireAuth({ admin: true });

if (admin) {
  initAdmin();
}


async function initAdmin() {
  try {
    await Promise.all([
      loadStats(),
      loadUsers(),
      loadPosts(),
      loadComments()
    ]);
  } catch (error) {
    showToast(
      error.message || "Не удалось загрузить админ-панель",
      "error"
    );
  }
}


// =========================
// СТАТИСТИКА
// =========================

async function loadStats() {
  const [
    users,
    posts,
    comments,
    likes
  ] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(collection(db, "posts")),
    getCountFromServer(collection(db, "comments")),
    getCountFromServer(collection(db, "likes"))
  ]);

  const items = [
    [
      "users",
      "Пользователи",
      users.data().count
    ],
    [
      "images",
      "Публикации",
      posts.data().count
    ],
    [
      "message-circle",
      "Комментарии",
      comments.data().count
    ],
    [
      "heart",
      "Лайки",
      likes.data().count
    ]
  ];

  document.querySelector("#admin-stats").innerHTML =
    items.map(([icon, label, value]) => `
      <div class="stat-card">
        <div class="stat-icon">
          <i data-lucide="${icon}"></i>
        </div>

        <strong>${value}</strong>
        <span>${label}</span>
      </div>
    `).join("");

  refreshIcons();
}


// =========================
// ПОЛЬЗОВАТЕЛИ
// =========================

async function loadUsers() {
  const snap = await getDocs(
    query(
      collection(db, "users"),
      orderBy("createdAt", "desc"),
      limit(100)
    )
  );

  document.querySelector("#users-table").innerHTML =
    snap.docs.map(d => {
      const u = d.data();

      return `
        <tr>

          <td>
            <div class="table-user">

              <span class="avatar avatar-sm">
                ${
                  u.avatar
                    ? `<img src="${escapeHtml(u.avatar)}">`
                    : escapeHtml(initials(u.name))
                }
              </span>

              <strong>
                ${escapeHtml(u.name || "Без имени")}
              </strong>

            </div>
          </td>

          <td>
            ${escapeHtml(u.email || "")}
          </td>

          <td>
            ${formatDate(u.createdAt)}
          </td>

          <td>

            <select
              class="role-select role-change"
              data-id="${d.id}"
            >

              <option
                value="user"
                ${u.role === "user" ? "selected" : ""}
              >
                user
              </option>

              <option
                value="admin"
                ${u.role === "admin" ? "selected" : ""}
              >
                admin
              </option>

            </select>

          </td>

          <td>

            <button
              class="icon-button user-block"
              data-id="${d.id}"
              data-blocked="${u.blocked === true}"
              aria-label="${
                u.blocked === true
                  ? "Разблокировать"
                  : "Заблокировать"
              }"
              type="button"
            >
              <i data-lucide="${
                u.blocked === true
                  ? "unlock"
                  : "ban"
              }"></i>
            </button>


            <button
              class="icon-button danger delete-user"
              data-id="${d.id}"
              aria-label="Удалить"
              type="button"
            >
              <i data-lucide="trash-2"></i>
            </button>

          </td>

        </tr>
      `;
    }).join("");


  // =========================
  // ИЗМЕНЕНИЕ РОЛИ
  // =========================

  document
    .querySelectorAll(".role-change")
    .forEach(select => {

      select.addEventListener(
        "change",
        async e => {

          try {

            await updateDoc(
              doc(db, "users", e.target.dataset.id),
              {
                role: e.target.value
              }
            );

            showToast(
              "Роль обновлена",
              "success"
            );

          } catch (error) {

            showToast(
              error.message ||
                "Не удалось изменить роль",
              "error"
            );

            loadUsers();
          }
        }
      );

    });


  // =========================
  // БЛОКИРОВКА
  // =========================

  document
    .querySelectorAll(".user-block")
    .forEach(button => {

      button.addEventListener(
        "click",
        async e => {

          const btn = e.currentTarget;

          const userId =
            btn.dataset.id;

          const blocked =
            btn.dataset.blocked === "true";


          if (userId === admin.uid) {

            showToast(
              "Нельзя заблокировать свой админ-профиль",
              "error"
            );

            return;
          }


          try {

            await updateDoc(
              doc(db, "users", userId),
              {
                blocked: !blocked
              }
            );


            showToast(
              blocked
                ? "Пользователь разблокирован"
                : "Пользователь заблокирован",
              "success"
            );


            await loadUsers();

          } catch (error) {

            showToast(
              error.message ||
                "Не удалось изменить статус",
              "error"
            );

          }

        }
      );

    });


  // =========================
  // УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
  // =========================

  document
    .querySelectorAll(".delete-user")
    .forEach(button => {

      button.addEventListener(
        "click",
        async e => {

          const userId =
            e.currentTarget.dataset.id;


          if (userId === admin.uid) {

            showToast(
              "Нельзя удалить свой админ-профиль",
              "error"
            );

            return;
          }


          const confirmed =
            await confirmDialog(
              "Удалить профиль пользователя из Firestore? Firebase Authentication аккаунт при этом не удаляется."
            );


          if (!confirmed) {
            return;
          }


          try {

            await deleteDoc(
              doc(db, "users", userId)
            );


            showToast(
              "Профиль удалён",
              "success"
            );


            await loadUsers();
            await loadStats();

          } catch (error) {

            showToast(
              error.message ||
                "Не удалось удалить профиль",
              "error"
            );

          }

        }
      );

    });


  refreshIcons();
}


// =========================
// ПУБЛИКАЦИИ
// =========================

async function loadPosts() {

  const snap = await getDocs(
    query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(50)
    )
  );


  document.querySelector("#admin-posts").innerHTML =
    snap.docs.map(d => {

      const p = d.data();

      return `
        <div class="admin-row">

          <span class="avatar avatar-sm">

            ${
              p.image
                ? `<img
                    src="${escapeHtml(p.image)}"
                    alt=""
                  >`
                : ""
            }

          </span>


          <div class="row-main">

            <strong>
              ${escapeHtml(p.authorName || "Пользователь")}
            </strong>

            <p>
              ${escapeHtml(
                p.text || "Без текста"
              )}
            </p>

          </div>


          <time class="muted">
            ${formatDate(p.createdAt)}
          </time>


          <button
            class="icon-button danger admin-delete-post"
            data-id="${d.id}"
            aria-label="Удалить"
            type="button"
          >
            <i data-lucide="trash-2"></i>
          </button>

        </div>
      `;

    }).join("") ||
    '<div class="empty-inline">Публикаций нет.</div>';


  document
    .querySelectorAll(".admin-delete-post")
    .forEach(btn => {

      btn.addEventListener(
        "click",
        async () => {

          const confirmed =
            await confirmDialog(
              "Удалить публикацию?"
            );


          if (!confirmed) {
            return;
          }


          try {

            await deleteDoc(
              doc(db, "posts", btn.dataset.id)
            );


            showToast(
              "Публикация удалена",
              "success"
            );


            await loadPosts();
            await loadStats();

          } catch (error) {

            showToast(
              error.message ||
                "Не удалось удалить публикацию",
              "error"
            );

          }

        }
      );

    });


  refreshIcons();
}


// =========================
// КОММЕНТАРИИ
// =========================

async function loadComments() {

  const snap = await getDocs(
    query(
      collection(db, "comments"),
      orderBy("createdAt", "desc"),
      limit(100)
    )
  );


  document.querySelector("#admin-comments").innerHTML =
    snap.docs.map(d => {

      const c = d.data();

      return `
        <div class="admin-row">

          <span class="avatar avatar-sm">
            ${escapeHtml(
              initials(c.authorName || "П")
            )}
          </span>


          <div class="row-main">

            <strong>
              ${escapeHtml(
                c.authorName || "Пользователь"
              )}
            </strong>

            <p>
              ${escapeHtml(c.text || "")}
            </p>

          </div>


          <button
            class="icon-button danger admin-delete-comment"
            data-id="${d.id}"
            data-post="${c.postId}"
            aria-label="Удалить"
            type="button"
          >
            <i data-lucide="trash-2"></i>
          </button>

        </div>
      `;

    }).join("") ||
    '<div class="empty-inline">Комментариев нет.</div>';


  document
    .querySelectorAll(".admin-delete-comment")
    .forEach(btn => {

      btn.addEventListener(
        "click",
        async () => {

          const confirmed =
            await confirmDialog(
              "Удалить комментарий?"
            );


          if (!confirmed) {
            return;
          }


          try {

            await deleteDoc(
              doc(
                db,
                "comments",
                btn.dataset.id
              )
            );


            if (btn.dataset.post) {

              await updateDoc(
                doc(
                  db,
                  "posts",
                  btn.dataset.post
                ),
                {
                  commentsCount: increment(-1)
                }
              );

            }


            showToast(
              "Комментарий удалён",
              "success"
            );


            await loadComments();
            await loadStats();

          } catch (error) {

            showToast(
              error.message ||
                "Не удалось удалить комментарий",
              "error"
            );

          }

        }
      );

    });


  refreshIcons();
}