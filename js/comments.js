import { db } from "./firebase.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  increment,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";


/* =========================
   ЗАГРУЗКА КОММЕНТАРИЕВ
========================= */

export function subscribeToComments(postId, callback) {
  if (!postId) {
    console.error("Нет postId");
    callback([]);
    return () => {};
  }

  // ТВОЯ ТЕКУЩАЯ СТРУКТУРА FIRESTORE:
  // comments
  //   ├── comment1
  //   ├── comment2
  //   └── ...
  //
  // У каждого комментария есть поле postId.

  const commentsRef = collection(db, "comments");

  // Только where.
  // orderBy здесь специально НЕ используем,
  // чтобы не требовался составной индекс.
  const q = query(
    commentsRef,
    where("postId", "==", postId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const comments = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      // Сортируем комментарии уже в браузере
      comments.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;

        return aTime - bTime;
      });

      console.log("Комментарии загружены:", comments);

      callback(comments);
    },
    (error) => {
      console.error("ОШИБКА КОММЕНТАРИЕВ:", error);
      callback([]);
    }
  );
}


/* =========================
   ДОБАВИТЬ КОММЕНТАРИЙ
========================= */

export async function addComment({
  postId,
  authorId,
  authorName,
  authorAvatar,
  text
}) {
  const cleanText = text?.trim();

  if (!postId) {
    throw new Error("Не указан ID публикации.");
  }

  if (!authorId) {
    throw new Error("Не указан автор.");
  }

  if (!cleanText) {
    return;
  }

  // Комментарий сохраняем в ТОЙ ЖЕ коллекции,
  // где уже находятся твои 2 комментария.
  await addDoc(collection(db, "comments"), {
    postId,
    authorId,
    authorName: authorName || "Пользователь",
    authorAvatar: authorAvatar || "",
    text: cleanText,
    createdAt: serverTimestamp()
  });

  // Увеличиваем счётчик поста
  const postRef = doc(db, "posts", postId);

  await updateDoc(postRef, {
    commentsCount: increment(1)
  });
}


/* =========================
   УДАЛИТЬ КОММЕНТАРИЙ
========================= */

export async function deleteComment(
  commentId,
  userId
) {
  if (!commentId) {
    throw new Error("Не указан комментарий.");
  }

  const commentRef = doc(
    db,
    "comments",
    commentId
  );

  const snap = await getDoc(commentRef);

  if (!snap.exists()) {
    throw new Error("Комментарий не найден.");
  }

  const data = snap.data();

  if (data.authorId !== userId) {
    throw new Error(
      "Можно удалить только свой комментарий."
    );
  }

  await deleteDoc(commentRef);

  // Уменьшаем счётчик
  if (data.postId) {
    const postRef = doc(
      db,
      "posts",
      data.postId
    );

    await updateDoc(postRef, {
      commentsCount: increment(-1)
    });
  }
}