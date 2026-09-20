import { requireAuth, getCurrentUser, logoutUser } from "./auth.js";
import { getCurrentUserProfile } from "./profile.js";
import { getFeedPage, enrichPosts, deletePost } from "./posts.js";
import { renderPostCard, showToast, refreshIcons, avatarMarkup } from "./ui.js";
import { escapeHtml, initials } from "./utils.js";

const page = document.body.dataset.page;
const user = await requireAuth();
if (user) {
  await buildShell();
  if (page === "home") initHome(user);
}

async function buildShell() {
  const profile = await getCurrentUserProfile();
  const active = page === "home" ? "home" : page;
  const items = [
    ["home","Главная","house","index.html"],["search","Поиск","search","search.html"],
    ["create","Создать","plus-square","create.html"],["saved","Сохранённое","bookmark","saved.html"],["profile","Профиль","user-round",`profile.html?id=${getCurrentUser().uid}`]
  ];
  if (profile?.role === "admin") items.push(["admin","Админ-панель","shield-check","admin.html"]);
  const nav = items.map(([key,label,icon,href]) => `<a class="nav-item ${active===key?"is-active":""}" href="${href}"><i data-lucide="${icon}"></i><span>${label}</span></a>`).join("");
  document.querySelector("#sidebar").innerHTML = `<a class="brand" href="index.html"><span class="brand-mark">ТП</span><span>Тики Пики</span></a><nav class="sidebar-nav">${nav}</nav><div class="sidebar-bottom"><div class="sidebar-user">${avatarMarkup(profile)}<div class="user-copy"><strong>${escapeHtml(profile?.name || "Пользователь")}</strong><small>${escapeHtml(profile?.email || "")}</small></div></div><button id="logout" class="nav-item" style="width:100%;border:0;background:transparent"><i data-lucide="log-out"></i><span>Выйти</span></button></div>`;
  document.querySelector("#topbar-user").innerHTML = `<a href="profile.html?id=${getCurrentUser().uid}" class="avatar">${profile?.avatar ? `<img src="${escapeHtml(profile.avatar)}">` : escapeHtml(initials(profile?.name))}</a>`;
  const mobile = document.createElement("nav"); mobile.className="bottom-nav";
  mobile.innerHTML = items.slice(0,5).map(([key,label,icon,href])=>`<a class="nav-item ${active===key?"is-active":""}" href="${href}"><i data-lucide="${icon}"></i><span>${label}</span></a>`).join("");
  document.body.appendChild(mobile);
  document.querySelector("#logout").addEventListener("click", async()=>{await logoutUser();location.href="login.html";});
  document.querySelector("#global-search")?.addEventListener("keydown", e=>{if(e.key==="Enter"&&e.target.value.trim())location.href=`search.html?q=${encodeURIComponent(e.target.value.trim())}`;});
  refreshIcons();
}

async function initHome(user) {
  const feed = document.querySelector("#feed"), loading = document.querySelector("#feed-loading"), empty = document.querySelector("#feed-empty"), more = document.querySelector("#load-more");
  let cursor = null, hasMore = true, activeTag = "";
  async function load(reset=false) {
    if (reset) { feed.innerHTML=""; cursor=null; hasMore=true; empty.classList.add("hidden"); }
    if (!hasMore) return;
    loading.classList.remove("hidden"); more.classList.add("hidden");
    try {
      const pageData = await getFeedPage({ userId:user.uid, pageSize:10, cursor, tag:activeTag });
      cursor=pageData.cursor; hasMore=pageData.hasMore;
      feed.insertAdjacentHTML("beforeend", pageData.posts.map(p=>renderPostCard(p,user)).join(""));
      refreshIcons();
      // Feed actions are handled once by the event-delegation listener below.
      empty.classList.toggle("hidden", feed.children.length>0);
      more.classList.toggle("hidden", !hasMore);
    } catch(error) { showToast(error.message || "Не удалось загрузить ленту","error"); }
    finally { loading.classList.add("hidden"); }
  }
  document.querySelectorAll(".filter-chip").forEach(chip=>chip.addEventListener("click",async()=>{document.querySelectorAll(".filter-chip").forEach(x=>x.classList.remove("is-active"));chip.classList.add("is-active");activeTag=chip.dataset.tag;await load(true);}));
  more.addEventListener("click",()=>load());

  // Event delegation keeps the feed lightweight when new pages are appended.
  feed.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const { toggleLike, toggleSavedPost } = await import("./posts.js");
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

  await load();
}