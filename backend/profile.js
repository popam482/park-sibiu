import { db, auth } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

const nameInput = document.getElementById("displayName");
const langSelect = document.getElementById("languageSelect");
const darkToggle = document.getElementById("darkModeToggle");
const saveNameBtn = document.getElementById("saveNameBtn");
const resetBtn = document.getElementById("resetPasswordBtn");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      const data = snapshot.data();

      nameInput.value = data.displayName || "";

      if (data.preferences) {
        langSelect.value = data.preferences.language || "en";
        darkToggle.checked = data.preferences.theme === "dark";
      }
    }

    applyTheme(darkToggle.checked);
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
});

function applyTheme(isDark) {
  if (isDark) {
    document.body.style.backgroundColor = "#333";
    document.body.style.color = "white";
  } else {
    document.body.style.backgroundColor = "white";
    document.body.style.color = "black";
  }
}

async function savePreferences() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      "preferences.language": langSelect.value,
      "preferences.theme": darkToggle.checked ? "dark" : "light"
    });
    applyTheme(darkToggle.checked);
  } catch (err) {
    console.error("Failed to save preferences:", err);
    alert("Could not save preferences.");
  }
}

langSelect.addEventListener("change", savePreferences);
darkToggle.addEventListener("change", savePreferences);

saveNameBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      displayName: nameInput.value.trim()
    });
    alert("Done! Name changed.");
  } catch (err) {
    console.error("Failed to save name:", err);
    alert("Could not update display name.");
  }
});

resetBtn.addEventListener("click", async () => {
  try {
    const user = auth.currentUser;
    const email = user?.email;

    if (!email) {
      alert("No email found for this account.");
      return;
    }

    await sendPasswordResetEmail(auth, email);
    alert("Check your email to change password.");
  } catch (err) {
    console.error("Password reset failed:", err);
    alert("Could not send password reset email.");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout failed:", err);
    alert("Could not log out.");
  }
});