import { db } from "./firebase.js";
import { collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { enrichPosts } from "./posts.js";

export async function searchPosts(searchTerm, userId = null) {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return [];
  const end = `${term}\uf8ff`;
  const [textSnap, authorSnap] = await Promise.all([
    getDocs(query(collection(db, "posts"), where("textLower", ">=", term), where("textLower", "<=", end), limit(25))),
    getDocs(query(collection(db, "posts"), where("authorNameLower", ">=", term), where("authorNameLower", "<=", end), limit(25)))
  ]);
  const map = new Map();
  [...textSnap.docs, ...authorSnap.docs].forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  const results = [...map.values()].sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 40);
  return enrichPosts(results, userId);
}