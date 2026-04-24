import { db, auth } from "../backend/firebase-config.js"; 
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { setLanguage, i18n } from './translations.js';
const getLang = () => localStorage.getItem('preferredLang') || 'en';
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const statusEl = document.getElementById("status");
const signinBtn = document.getElementById("signinBtn");
const signupBtn = document.getElementById("signupBtn");
const googleBtn = document.getElementById("googleBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Ensures a user document exists in Firestore after login

async function ensureUserProfile(user) {
    try {
        const ref = doc(db, "users", user.uid);
        const existing = await getDoc(ref);

        if (!existing.exists()) {
            await setDoc(ref, {
                uid: user.uid,
                email: user.email || "",
                displayName: user.displayName || "",
                licensePlates: [],
                role: "user",
                createdAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Error creating user profile:", error);
    }
}

// Email & Password Sign In
if (signinBtn) {
    signinBtn.addEventListener("click", async () => {
        try {
            const email = emailEl.value.trim();
            const password = passwordEl.value;
            const cred = await signInWithEmailAndPassword(auth, email, password);
            await ensureUserProfile(cred.user);
            alert(i18n[getLang()].alert_login_success || "Login Successful!");
            window.location.href = "index.html"; 
        } catch (e) {
            alert("Login Error: " + e.message);
        }
    });
}

// Email & Password Sign Up
if (signupBtn) {
    signupBtn.addEventListener("click", async () => {
        try {
            const email = emailEl.value.trim();
            const password = passwordEl.value;
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await ensureUserProfile(cred.user);
            alert(i18n[getLang()].alert_signup_success || "Account Created Successfully!");
        } catch (e) {
            alert("Sign Up Error: " + e.message);
        }
    });
}

// Google Login
if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        try {
            const provider = new GoogleAuthProvider();
            const cred = await signInWithPopup(auth, provider);
            await ensureUserProfile(cred.user);
            window.location.href = "index.html";
        } catch (e) {
            alert("Google Login Error: " + e.message);
        }
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            alert(i18n[getLang()].alert_logout || "Logged out!");
        } catch (e) {
            alert("Logout Error: " + e.message);
        }
    });
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
//   if (statusEl) {
//     statusEl.textContent = user
//       ? `Logged in as: ${user.email || user.displayName}`
//       : "Not logged in";
//   }
  const savedLang = localStorage.getItem('preferredLang') || 'en';
  if (statusEl) {
    const statusText = user 
      ? `${i18n[savedLang].login_status_on || "Logged in as"}: ${user.email || user.displayName}` 
      : (i18n[savedLang].login_status_off || "Not logged in");
    statusEl.textContent = statusText;
  }

  if (logoutBtn) logoutBtn.style.display = user ? "block" : "none";

  if (user) {
    console.log("User is already logged in, redirecting...");
  }
});

window.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'en';
    setLanguage(savedLang);
});