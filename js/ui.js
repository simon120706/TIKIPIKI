import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { escapeHtml, formatDate, initials } from "./utils.js";

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

export function showToast(message, type = "info") {
  const root = document.querySelector("#toast-root");
  if (!root) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${type === "error" ? "circle-alert" : type === "success" ? "circle-check" : "info"}"></i><span>${escapeHtml(message)}</span>`;
  root.appendChild(toast);
  refreshIcons();
  setTimeout(() => toast.remove(), 3600);
}

export function confirmDialog(message) {
  return new Promise(resolve => {
    const root = document.querySelector("#modal-root") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "modal-root" }));
    root.innerHTML = `<div class="modal-backdrop"><div class="modal"><h3>Подтверждение</h3><p>${escapeHtml(message)}</p><div class="modal-actions"><button class="button button-secondary" data-cancel>Отмена</button><button class="button button-primary" data-confirm>Подтвердить</button></div></div></div>`;
    const close = value => { root.innerHTML = ""; resolve(value); };
    root.querySelector("[data-cancel]").onclick = () => close(false);
    root.querySelector("[data-confirm]").onclick = () => close(true);
    root.querySelector(".modal-backdrop").addEventListener("click", e => { if (e.target === e.currentTarget) close(false); });
  });
}

export function avatarMarkup(user, className = "avatar") {
  const name = user?.name || user?.authorName || "П";
  return `<span class="${className}">${user?.avatar || user?.authorAvatar ? `<img src="${escapeHtml(user.avatar || user.authorAvatar)}" alt="">` : escapeHtml(initials(name))}</span>`;
}

export function renderPostCard(post, currentUser, { compact = false } = {}) {
  const liked = Boolean(post.likedByCurrentUser);
  const saved = Boolean(post.savedByCurrentUser);
  const tags = (post.tags || [])
    .map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`)
    .join("");

  return `<article class="post-card" data-post-id="${post.id}">
    <a class="post-media" href="post.html?id=${post.id}">
      <img loading="lazy"
        src="${escapeHtml(post.image)}"
        alt="${escapeHtml(post.text || "Публикация")}"
        onerror="this.style.display='none'">
    </a>

    <div class="post-body">

      <div class="post-author">
        ${avatarMarkup(
          { name: post.authorName, avatar: post.authorAvatar },
          "avatar avatar-sm"
        )}

        <div class="post-author-info">
          <a href="profile.html?id=${post.authorId}">
            <strong>${escapeHtml(post.authorName)}</strong>
          </a>
          <time>${formatDate(post.createdAt)}</time>
        </div>

        <a
          class="post-link"
          href="post.html?id=${post.id}"
          aria-label="Открыть">
          <i data-lucide="arrow-up-right"></i>
        </a>
      </div>

      ${
        post.text
          ? `<p class="post-text">${escapeHtml(post.text)}</p>`
          : ""
      }

      ${
        tags
          ? `<div class="post-tags">${tags}</div>`
          : ""
      }

<div class="post-actions post-actions-bottom">

  <div class="action-item">
    <button
      class="icon-button like-button ${liked ? "is-liked" : ""}"
      data-action="like"
      data-id="${post.id}"
      aria-label="Нравится"
      type="button"
    >
      <span class="action-icon">
        <i
          data-lucide="heart"
          ${liked ? 'fill="currentColor"' : ""}
        ></i>
      </span>
    </button>

    <span class="action-count">
      ${post.likesCount || 0}
    </span>
  </div>


  <div class="action-item">
    <a
      class="icon-button comment-button"
      href="post.html?id=${post.id}"
      aria-label="Комментарии"
    >
      <span class="action-icon">
        <i data-lucide="message-circle"></i>
      </span>
    </a>

    <span class="action-count">
      ${post.commentsCount || 0}
    </span>
  </div>


  <div class="action-item">
    <button
      class="icon-button save-button ${saved ? "is-saved" : ""}"
      data-action="save"
      data-id="${post.id}"
      aria-label="Сохранить"
      type="button"
    >
      <span class="action-icon">
        <i
          data-lucide="bookmark"
          ${saved ? 'fill="currentColor"' : ""}
        ></i>
      </span>
    </button>
  </div>

</div>

    </div>
  </article>`;
}

export function renderPostDetail(post, currentUser) {
  const root = document.querySelector("#post-detail");
  if (!root) return;
  const liked = Boolean(post.likedByCurrentUser), saved = Boolean(post.savedByCurrentUser);
  root.innerHTML = `<div class="detail-image"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.text || "Публикация")}"></div>
    <div class="detail-side"><div class="post-author">${avatarMarkup({name:post.authorName,avatar:post.authorAvatar})}<div class="post-author-info"><a href="profile.html?id=${post.authorId}"><strong>${escapeHtml(post.authorName)}</strong></a><time>${formatDate(post.createdAt)}</time></div></div>
    ${post.text ? `<p class="detail-text">${escapeHtml(post.text)}</p>` : ""}
    <div class="post-tags">${(post.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join("")}</div>
    <div class="detail-actions"><button class="icon-button like-button ${liked ? "is-liked" : ""}" data-action="like" data-id="${post.id}" aria-label="Нравится"><i data-lucide="heart" ${liked ? 'fill="currentColor"' : ""}></i></button><span class="action-count" id="detail-like-count">${post.likesCount || 0}</span><button class="icon-button save-button ${saved ? "is-saved" : ""}" data-action="save" data-id="${post.id}" aria-label="Сохранить"><i data-lucide="bookmark" ${saved ? 'fill="currentColor"' : ""}></i></button><span class="muted">Сохранить</span></div></div>`;
  refreshIcons();
  root.querySelectorAll("[data-action='like'],[data-action='save']").forEach(bindActionButton);
}

function bindActionButton(button) {
  button.addEventListener("click", async event => {
    event.preventDefault(); event.stopPropagation();
    const { toggleLike } = await import("./posts.js");
    const { toggleSavedPost } = await import("./posts.js");
    const user = (await import("./auth.js")).getCurrentUser();
    if (!user) return;
    try {
      if (button.dataset.action === "like") {
        const result = await toggleLike(button.dataset.id, user.uid);
        button.classList.toggle("is-liked", result.liked);
        button.innerHTML = `<i data-lucide="heart" ${result.liked ? 'fill="currentColor"' : ""}></i>`;
        const count = button.parentElement.querySelector(".action-count");
        if (count) count.textContent = result.likesCount;
      } else {
        const result = await toggleSavedPost(button.dataset.id, user.uid);
        button.classList.toggle("is-saved", result.saved);
        button.innerHTML = `<i data-lucide="bookmark" ${result.saved ? 'fill="currentColor"' : ""}></i>`;
      }
      refreshIcons();
    } catch (error) { showToast(error.message || "Не удалось выполнить действие", "error"); }
  });
}

export async function hydratePostActions(root, user) {
  root.querySelectorAll("[data-action]").forEach(bindActionButton);
  refreshIcons();
}