// Firebase configuration. Replace only these placeholders with your own Firebase Web App config.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
 apiKey: "AIzaSyCuGPb3N1r879-DtnIFO_jhC-1puONl0fI",
 authDomain: "tikipiki-fa307.firebaseapp.com",
 projectId: "tikipiki-fa307",
 storageBucket: "tikipiki-fa307.firebasestorage.app",
 messagingSenderId: "145445423697",
 appId: "1:145445423697:web:422c9d02bb00248f7e4670",
 measurementId: "G-M031GPHD23"
};


export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
