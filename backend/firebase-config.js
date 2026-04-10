import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDac1qtN0GoMzQ7uJ7IuELoiEewY-WVtUo",
    authDomain: "park-sibiu.firebaseapp.com",
    projectId: "park-sibiu",
    storageBucket: "park-sibiu.firebasestorage.app",
    messagingSenderId: "373335639720",
    appId: "1:373335639720:web:f38c4aa8dc6083b6a2e49d",
    measurementId: "G-FCJ16FVFBW"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

console.log("Firebase initialized and exported!");