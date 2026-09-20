import { auth, db } from "./firebase.js";
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs, serverTimestamp, addDoc, deleteDoc, increment, runTransaction } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { requireAuth, getCurrentUser } from "./auth.js";
import { avatarMarkup, renderPostCard, showToast, confirmDialog, refreshIcons } from "./ui.js";
import { formatDate, escapeHtml, initials } from "./utils.js";
import { toggleFollow, getFollowState } from "./posts.js";

export async function getCurrentUserProfile() {
  const user = getCurrentUser();
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function loadUserPosts(uid) {
  const snap = await getDocs(query(collection(db, "posts"), where("authorId", "==", uid), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateProfileForm(uid, profile) {
  const root = document.querySelector("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal"><h3>Редактировать профиль</h3><form id="profile-edit-form" class="form-stack">
    <label>Имя<input name="name" required maxlength="40" value="${escapeHtml(profile.name || "")}"></label>
    <label>Описание<textarea name="bio" rows="4" maxlength="180">${escapeHtml(profile.bio || "")}</textarea></label>
    <label>URL аватара<input name="avatar" type="url" value="${escapeHtml(profile.avatar || "")}" placeholder="https://..."></label>
    <div class="modal-actions"><button type="button" class="button button-secondary" data-close>Отмена</button><button class="button button-primary">Сохранить</button></div>
  </form></div></div>`;
  root.querySelector("[data-close]").onclick = () => root.innerHTML = "";
  root.querySelector("form").onsubmit = async e => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    await updateDoc(doc(db, "users", uid), { name: data.get("name").trim(), bio: data.get("bio").trim(), avatar: data.get("avatar").trim() });
    root.innerHTML = ""; showToast("Профиль обновлён", "success"); renderProfile(uid);
  };
}

export async function renderProfile(uid) {
  const current = getCurrentUser();
  const profile = await getUserProfile(uid);
  const root = document.querySelector("#profile-view");
  if (!profile) { root.innerHTML = `<div class="empty-state"><h2>Пользователь не найден</h2></div>`; return; }
  const posts = await loadUserPosts(uid);
  const isOwn = current?.uid === uid;
  const following = current && !isOwn ? await getFollowState(current.uid, uid) : false;
  root.classList.remove("skeleton-card");
  root.innerHTML = `<div class="avatar" style="width:94px;height:94px">${profile.avatar ? `<img src="${escapeHtml(profile.avatar)}" alt="">` : escapeHtml(initials(profile.name))}</div>
    <div class="profile-main"><p class="eyebrow">${profile.role === "admin" ? "Administrator" : "Profile"}</p><h1>${escapeHtml(profile.name)}</h1><p class="bio">${escapeHtml(profile.bio || "Пользователь ещё не добавил описание.")}</p>
    <div class="profile-actions">${isOwn ? `<button id="edit-profile" class="button button-secondary"><i data-lucide="pencil"></i> Редактировать</button>` : `<button id="follow-profile" class="button ${following ? "button-secondary" : "button-primary"}">${following ? "Отписаться" : "Подписаться"}</button>`}</div></div>
    <div class="profile-stats"><div class="profile-stat"><strong>${posts.length}</strong><span>публикаций</span></div><div class="profile-stat"><strong>${profile.followersCount || 0}</strong><span>подписчиков</span></div><div class="profile-stat"><strong>${profile.followingCount || 0}</strong><span>подписок</span></div></div>`;
  document.querySelector("#profile-posts").innerHTML = posts.map(p => `<a class="profile-tile" href="post.html?id=${p.id}"><img loading="lazy" src="${escapeHtml(p.image)}" alt=""><span class="tile-overlay">${escapeHtml(p.text || "")}</span></a>`).join("");
  document.querySelector("#profile-empty").classList.toggle("hidden", posts.length > 0);
  document.querySelector("#edit-profile")?.addEventListener("click", () => updateProfileForm(uid, profile));
  document.querySelector("#follow-profile")?.addEventListener("click", async e => {
    e.currentTarget.disabled = true;
    try { const result = await toggleFollow(current.uid, uid); showToast(result.following ? "Подписка оформлена" : "Подписка отменена", "success"); renderProfile(uid); }
    finally { e.currentTarget.disabled = false; }
  });
  refreshIcons();
}

