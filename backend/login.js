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
import { i18n } from "./translations.js";

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const statusEl = document.getElementById("status");
const signinBtn = document.getElementById("signinBtn");
const signupBtn = document.getElementById("signupBtn");
const googleBtn = document.getElementById("googleBtn");
const logoutBtn = document.getElementById("logoutBtn");
const currentLang = localStorage.getItem('preferredLang') || (navigator.language.startsWith('ro') ? 'ro' : 'en');
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
                preferences: {
                    language: currentLang, // Îi punem nativ limba pe care o are acum la login
                    theme: "light"
                },
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
            alert(i18n[currentLang].alert_login_success);
            window.location.href = "index.html"; 
        } catch (e) {
            alert(i18n[currentLang].alert_login_error + e.message);
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
            alert(i18n[currentLang].alert_register_success);
        } catch (e) {
            alert(i18n[currentLang].alert_register_error + e.message);
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
            alert(i18n[currentLang].alert_google_error + e.message);
        }
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            alert(i18n[currentLang].alert_logout_success);
        } catch (e) {
            alert(i18n[currentLang].alert_logout_error + e.message);
        }
    });
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
  if (statusEl) {
   statusEl.textContent = user
      ? `${i18n[currentLang].status_logged_in}${user.email || user.displayName}`
      : i18n[currentLang].status_logged_out;
  }

  if (logoutBtn) logoutBtn.style.display = user ? "block" : "none";

  if (user) {
    console.log("User is already logged in, redirecting...");
  }
});
function updateLoginPageLanguage(lang) {
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");
        if (i18n[lang] && i18n[lang][key]) {
            element.innerText = i18n[lang][key];
        }
    });

    if (emailEl && i18n[lang].placeholder_email) {
        emailEl.placeholder = i18n[lang].placeholder_email;
    }
    if (passwordEl && i18n[lang].placeholder_password) {
        passwordEl.placeholder = i18n[lang].placeholder_password;
    }
}

updateLoginPageLanguage(currentLang);
