import { db, auth } from "./firebase-config.js";
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

const nameInput = document.getElementById("displayName");
const langSelect = document.getElementById("languageSelect");
const darkToggle = document.getElementById("darkModeToggle");
const saveNameBtn = document.getElementById("saveNameBtn");
const resetBtn = document.getElementById("resetPasswordBtn");
const logoutBtn = document.getElementById("logoutBtn");


const newPlateInput = document.getElementById("newPlateNumber"); 
const savePlateBtn = document.getElementById("savePlateBtn");    
const platesList = document.getElementById("savedPlatesList"); 
const favoriteSelect = document.getElementById("favoritePlateSelect");

const nameInputArea = document.getElementById("nameInputArea");
const greetingArea = document.getElementById("greetingArea");
const subGreetingtext = document.getElementById("subGreetingtext");

let licensePlates = [];

function validateROPlate(plate) {
    const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
    const regex = /^(B\d{2,3}[A-Z]{3})$|^([A-Z]{2}\d{2}[A-Z]{3})$/;
    return regex.test(cleanPlate);
}

document.getElementById('togglePlatesBtn')?.addEventListener('click', () => {
    const accordion = document.getElementById('platesAccordion');
    const btn = document.getElementById('togglePlatesBtn');
    if (accordion.style.display === "none") {
        accordion.style.display = "block";
        btn.innerText = "Hide Saved Plates ▲";
    } else {
        accordion.style.display = "none";
        btn.innerText = "View Saved Plates ▼";
    }
});

document.getElementById('countryProfileSelect')?.addEventListener('change', (e) => {
    if (newPlateInput) {
        newPlateInput.placeholder = (e.target.value === "RO") ? "Ex: B123ABC" : "Enter plate number";
    }
});

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
if (data.displayName) {
    nameInput.value = data.displayName;
    showGreeting(data.displayName);
}

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
    await setDoc(userRef, { 
      licensePlates: licensePlates 
    }, { merge: true });
    
    alert("License plates updated!");
  } catch (err) {
    console.error("Failed to save license plates:", err);
    alert("Could not update license plates.");
  }
}

function renderPlates() {
  if (!platesList) return;
  platesList.innerHTML = "";
  
  if (favoriteSelect) {
    favoriteSelect.innerHTML = '<option value=""> Select Favorite Plate </option>';
  }

  if (licensePlates.length === 0) {
    platesList.innerHTML = "<li>No license plates added yet.</li>";
    return;
  }

  const currentFav = localStorage.getItem('favoritePlate');

  licensePlates.forEach((plate, index) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.marginBottom = "5px";
    
    const isFav = plate === currentFav;
    li.innerHTML = `<span>${plate} ${isFav ? '⭐' : ''}</span>`;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.style.background = "#e74c3c";
    removeBtn.style.color = "white";
    removeBtn.style.border = "none";
    removeBtn.style.padding = "2px 8px";
    removeBtn.style.borderRadius = "3px";
    removeBtn.style.cursor = "pointer";
    
    removeBtn.onclick = async () => {
      if (plate === currentFav) {
        localStorage.removeItem('favoritePlate');
      }
      licensePlates.splice(index, 1);
      await persistLicensePlates();
      renderPlates();
    };

    li.appendChild(removeBtn);
    platesList.appendChild(li);

    if (favoriteSelect) {
      const opt = document.createElement("option");
      opt.value = plate;
      opt.textContent = plate;
      favoriteSelect.appendChild(opt);
    }
  });

  if (currentFav && licensePlates.includes(currentFav)) {
    favoriteSelect.value = currentFav;
  }
}

if (savePlateBtn) {
  savePlateBtn.addEventListener("click", async () => {
    const country = document.getElementById('countryProfileSelect').value;
    const raw = newPlateInput?.value?.trim() || "";
    const plate = normalizePlate(raw);

    if (!plate) return;

    if (country === "RO") {
        if (!validateROPlate(plate)) {
            alert("INVALID FORMAT!\nEx: SB12ABC OR B123ABC");
            return;
        }
    } else {
        if (plate.length > 14) {
            alert("International plates cannot exceed 14 characters!");
            return;
        }
    }

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
    await setDoc(userRef, {
      preferences: {
        language: langSelect.value,
        theme: darkToggle.checked ? "dark" : "light"
      }
    }, { merge: true });
    applyTheme(darkToggle.checked);
  } catch (err) {
    console.error("Failed to save preferences:", err);
  }
}

langSelect.addEventListener("change", savePreferences);
darkToggle.addEventListener("change", savePreferences);

// saveNameBtn.addEventListener("click", async () => {
//   const user = auth.currentUser;
//   if (!user) return;

//   try {
//     const userRef = doc(db, "users", user.uid);
//     await setDoc(userRef, {
//       displayName: nameInput.value.trim()
//     }, { merge: true });
//     alert("Done! Name changed.");
//   } catch (err) {
//     console.error("Failed to save name:", err);
//     alert("Could not update display name.");
//   }
// });


saveNameBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const newName = nameInput.value.trim();

  if (!newName) {
      alert("Please enter a name.");
      return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, { displayName: newName }, { merge: true });
    
    showGreeting(newName); 
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

document.getElementById('countryProfileSelect')?.addEventListener('change', (e) => {
    const input = document.getElementById('newPlateNumber');
    if (e.target.value === "RO") {
        input.placeholder = "Ex: B123ABC";
    } else {
        input.placeholder = "Enter plate number";
    }
});
document.getElementById('saveFavoriteBtn')?.addEventListener('click', () => {
  const selectedFav = favoriteSelect.value;
  if (!selectedFav) return alert("Select a plate first!");
  
  localStorage.setItem('favoritePlate', selectedFav);
  alert(`Plate ${selectedFav} is now your favorite!`);
  renderPlates(); 
});

function showGreeting(name) {
    nameInputArea.style.display = "none";
    greetingArea.innerText = `Hello, ${name}! 👋`;
    greetingArea.style.display = "block";

    const cuteMessages = [
        "Ready to find the perfect parking spot?",
        "Have a wonderful day in Sibiu!",
        "Your car missed you!",
        "Looking sharp today!",
        "Let's make parking easy for you.",
        "Glad to see you back!",
        "Stay awesome!"
    ];

    const randomMessage = cuteMessages[Math.floor(Math.random() * cuteMessages.length)];

    subGreetingtext.innerText = randomMessage;
    subGreetingtext.style.display = "block";
}