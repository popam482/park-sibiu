import { db, auth } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

const nameInput = document.getElementById("displayName");
const langSelect = document.getElementById("languageSelect");
const darkToggle = document.getElementById("darkModeToggle");
const saveNameBtn = document.getElementById("saveNameBtn");
const resetBtn = document.getElementById("resetPasswordBtn");
const logoutBtn = document.getElementById("logoutBtn");


const newPlateInput = document.getElementById("newPlateInput");
const addPlateBtn = document.getElementById("addPlateBtn");
const platesList = document.getElementById("platesList");

let licensePlates = [];

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

      // migration: old single field -> new array field
      if (Array.isArray(data.licensePlates)) {
        licensePlates = data.licensePlates;
      } else if (typeof data.licensePlate === "string" && data.licensePlate.trim() !== "") {
        licensePlates = [normalizePlate(data.licensePlate)];
        await updateDoc(userRef, { licensePlates });
      } else {
        licensePlates = [];
      }

      if (data.preferences) {
        langSelect.value = data.preferences.language || "en";
        darkToggle.checked = data.preferences.theme === "dark";
      }
    }

    renderPlates();
    applyTheme(darkToggle.checked);
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
});

function applyTheme(isDark) {
  document.body.classList.toggle("dark-theme", isDark);
  document.body.classList.toggle("light-theme", !isDark);
}

function normalizePlate(value) {
  return value.replace(/\s+/g, "").toUpperCase();
}

async function persistLicensePlates() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { licensePlates });
  } catch (err) {
    console.error("Failed to save license plates:", err);
    alert("Could not update license plates.");
  }
}

function renderPlates() {
  if (!platesList) return;
  platesList.innerHTML = "";

  if (licensePlates.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No license plates added yet.";
    platesList.appendChild(li);
    return;
  }

  licensePlates.forEach((plate, index) => {
    const li = document.createElement("li");
    li.style.marginBottom = "8px";

    const plateText = document.createElement("span");
    plateText.textContent = plate;
    plateText.style.marginRight = "10px";

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      licensePlates.splice(index, 1);
      await persistLicensePlates();
      renderPlates();
    });

    li.appendChild(plateText);
    li.appendChild(removeBtn);
    platesList.appendChild(li);
  });
}

if (addPlateBtn) {
  addPlateBtn.addEventListener("click", async () => {
    const raw = newPlateInput?.value?.trim() || "";
    const plate = normalizePlate(raw);

    if (!plate) return;

    if (licensePlates.includes(plate)) {
      alert("This license plate already exists.");
      return;
    }

    licensePlates.push(plate);
    await persistLicensePlates();
    renderPlates();

    if (newPlateInput) newPlateInput.value = "";
  });
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
    const email = auth.currentUser?.email;

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