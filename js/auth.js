import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { showToast } from "./ui.js";

let currentUser = null;
onAuthStateChanged(auth, user => { currentUser = user; });

export function getCurrentUser() { return currentUser || auth.currentUser; }

export async function registerUser({ name, email, password }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await setDoc(doc(db, "users", credential.user.uid), {
    id: credential.user.uid, name, email, avatar: "", bio: "",
    role: "user", followersCount: 0, followingCount: 0, createdAt: serverTimestamp()
  });
  return credential.user;
}

export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutUser() { await signOut(auth); }

export async function resetPassword(email) { await sendPasswordResetEmail(auth, email); }

export function requireAuth({ admin = false } = {}) {
  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      unsubscribe();
      if (!user) { location.href = "login.html"; resolve(null); return; }
      if (admin) {
        const profile = await getDoc(doc(db, "users", user.uid));
        if (!profile.exists() || profile.data().role !== "admin") {
          showToast("Доступ только для администратора", "error");
          location.href = "index.html"; resolve(null); return;
        }
      }
      currentUser = user;
      resolve(user);
    });
  });
}

export function initAuthPage() {
  const tabs = document.querySelectorAll("[data-auth-view]");
  const views = { login: document.querySelector("#auth-login"), register: document.querySelector("#auth-register"), reset: document.querySelector("#auth-reset") };
  const message = document.querySelector("#auth-message");
  const setView = view => {
    Object.entries(views).forEach(([key, el]) => el?.classList.toggle("hidden", key !== view));
    tabs.forEach(tab => tab.classList.toggle("is-active", tab.dataset.authView === view));
    message.textContent = "";
  };
  tabs.forEach(tab => tab.addEventListener("click", () => setView(tab.dataset.authView)));
  document.querySelector("#show-reset")?.addEventListener("click", () => setView("reset"));
  document.querySelector("#back-to-login")?.addEventListener("click", () => setView("login"));

  document.querySelector("#login-form")?.addEventListener("submit", async e => {
    e.preventDefault(); message.textContent = "";
    const data = new FormData(e.currentTarget);
    try { await loginUser(data.get("email"), data.get("password")); location.href = "index.html"; }
    catch (error) { message.textContent = friendlyAuthError(error); }
  });
  document.querySelector("#register-form")?.addEventListener("submit", async e => {
    e.preventDefault(); message.textContent = "";
    const data = new FormData(e.currentTarget);
    try { await registerUser({ name: data.get("name").trim(), email: data.get("email").trim(), password: data.get("password") }); location.href = "index.html"; }
    catch (error) { message.textContent = friendlyAuthError(error); }
  });
  document.querySelector("#reset-form")?.addEventListener("submit", async e => {
    e.preventDefault(); message.textContent = "";
    try { await resetPassword(new FormData(e.currentTarget).get("email").trim()); showToast("Письмо для восстановления отправлено", "success"); setView("login"); }
    catch (error) { message.textContent = friendlyAuthError(error); }
  });
}

function friendlyAuthError(error) {
  const map = {
    "auth/email-already-in-use": "Этот email уже зарегистрирован.",
    "auth/invalid-credential": "Неверный email или пароль.",
    "auth/weak-password": "Пароль слишком слабый.",
    "auth/invalid-email": "Проверь формат email.",
    "auth/too-many-requests": "Слишком много попыток. Попробуй позже."
  };
  return map[error.code] || "Не удалось выполнить операцию. Проверь данные и настройки Firebase.";
}