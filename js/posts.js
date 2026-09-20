import { db } from "./firebase.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter,
  addDoc, setDoc, deleteDoc, serverTimestamp, increment, runTransaction, documentId
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

export async function createPost({ authorId, authorName, authorAvatar, text, image, tags, category }) {
  if (!image) throw new Error("Добавь ссылку на изображение.");
  const post = {
    authorId, authorName, authorAvatar: authorAvatar || "", text: text || "", image,
    tags: tags || [], category: category || "life", likesCount: 0, commentsCount: 0,
    createdAt: serverTimestamp(), textLower: text.toLowerCase(), authorNameLower: authorName.toLowerCase()
  };
  return addDoc(collection(db, "posts"), post);
}

export async function getPost(postId, userId = null) {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return null;
  const post = { id: snap.id, ...snap.data() };
  if (userId) {
    post.likedByCurrentUser = (await getDoc(doc(db, "likes", `${postId}_${userId}`))).exists();
    post.savedByCurrentUser = (await getDoc(doc(db, "savedPosts", `${userId}_${postId}`))).exists();
  }
  return post;
}

export async function getFeedPage({ userId, pageSize = 10, cursor = null, tag = "" }) {
  const constraints = [];
  if (tag) constraints.push(where("tags", "array-contains", tag));
  constraints.push(orderBy("createdAt", "desc"));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  const snap = await getDocs(query(collection(db, "posts"), ...constraints));
  const posts = await enrichPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })), userId);
  return { posts, cursor: snap.docs.at(-1) || null, hasMore: snap.docs.length === pageSize };
}

export async function enrichPosts(posts, userId) {
  if (!userId || !posts.length) return posts;

  const results = await Promise.all(
    posts.map(async post => {
      const [like, save] = await Promise.all([
        getDoc(doc(db, "likes", `${post.id}_${userId}`)),
        getDoc(doc(db, "savedPosts", `${userId}_${post.id}`))
      ]);

      return {
        id: post.id,
        liked: like.exists(),
        saved: save.exists()
      };
    })
  );

  return posts.map(post => {
    const result = results.find(item => item.id === post.id);

    return {
      ...post,
      likedByCurrentUser: result?.liked || false,
      savedByCurrentUser: result?.saved || false
    };
  });
}

export async function toggleLike(postId, userId) {
  const likeRef = doc(db, "likes", `${postId}_${userId}`);
  const postRef = doc(db, "posts", postId);
  return runTransaction(db, async tx => {
    const [likeSnap, postSnap] = await Promise.all([tx.get(likeRef), tx.get(postRef)]);
    if (!postSnap.exists()) throw new Error("Публикация не найдена.");
    const current = postSnap.data().likesCount || 0;
    if (likeSnap.exists()) {
      tx.delete(likeRef); tx.update(postRef, { likesCount: Math.max(0, current - 1) });
      return { liked: false, likesCount: Math.max(0, current - 1) };
    }
    tx.set(likeRef, { postId, userId, createdAt: serverTimestamp() });
    tx.update(postRef, { likesCount: current + 1 });
    return { liked: true, likesCount: current + 1 };
  });
}

export async function toggleSavedPost(postId, userId) {
  const ref = doc(db, "savedPosts", `${userId}_${postId}`);
  const snap = await getDoc(ref);
  if (snap.exists()) { await deleteDoc(ref); return { saved: false }; }
  await setDoc(ref, { userId, postId, createdAt: serverTimestamp() }); return { saved: true };
}

export async function getSavedPosts(userId) {
  const snap = await getDocs(query(collection(db, "savedPosts"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(50)));
  const posts = [];
  for (const save of snap.docs) {
    const post = await getPost(save.data().postId, userId);
    if (post) posts.push(post);
  }
  return posts;
}

export async function toggleFollow(followerId, followingId) {
  if (followerId === followingId) throw new Error("Нельзя подписаться на себя.");
  const ref = doc(db, "follows", `${followerId}_${followingId}`);
  const followerRef = doc(db, "users", followerId), followingRef = doc(db, "users", followingId);
  return runTransaction(db, async tx => {
    const [followSnap, followerSnap, followingSnap] = await Promise.all([tx.get(ref), tx.get(followerRef), tx.get(followingRef)]);
    if (!followingSnap.exists()) throw new Error("Пользователь не найден.");
    const followerCount = followerSnap.data()?.followingCount || 0, followingCount = followingSnap.data()?.followersCount || 0;
    if (followSnap.exists()) {
      tx.delete(ref);
      tx.update(followerRef, { followingCount: Math.max(0, followerCount - 1) });
      tx.update(followingRef, { followersCount: Math.max(0, followingCount - 1) });
      return { following: false };
    }
    tx.set(ref, { followerId, followingId, createdAt: serverTimestamp() });
    tx.update(followerRef, { followingCount: followerCount + 1 });
    tx.update(followingRef, { followersCount: followingCount + 1 });
    return { following: true };
  });
}

export async function getFollowState(followerId, followingId) {
  return (await getDoc(doc(db, "follows", `${followerId}_${followingId}`))).exists();
}

export async function deletePost(postId, userId) {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return;
  if (snap.data().authorId !== userId) throw new Error("Удалять можно только свои публикации.");
  await deleteDoc(doc(db, "posts", postId));
}

export async function updatePost(postId, userId, changes) {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Публикация не найдена.");
  if (snap.data().authorId !== userId) throw new Error("Редактировать можно только свои публикации.");
  const safe = {
    text: String(changes.text || "").trim(),
    image: String(changes.image || "").trim(),
    tags: Array.isArray(changes.tags) ? changes.tags.slice(0, 5) : [],
    category: changes.category || "life"
  };
  await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js").then(({ updateDoc }) =>
    updateDoc(ref, { ...safe, textLower: safe.text.toLowerCase() })
  );
}
