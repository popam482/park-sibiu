import { db, auth } from "./firebase-config.js";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { i18n } from "./translations.js";

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
let currentMessageIndex = 0;
function validateROPlate(plate) {
    const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
    const regex = /^(B\d{2,3}[A-Z]{3})$|^([A-Z]{2}\d{2}[A-Z]{3})$/;
    return regex.test(cleanPlate);
}

document.getElementById('togglePlatesBtn')?.addEventListener('click', () => {
    const accordion = document.getElementById('platesAccordion');
    const btn = document.getElementById('togglePlatesBtn');
    const lang = langSelect.value || "en";
    if (accordion.style.display === "none") {
        accordion.style.display = "block";
        btn.innerText = i18n[lang].hide_plates;
    } else {
        accordion.style.display = "none";
        btn.innerText = i18n[lang].view_plates;
    }
});

document.getElementById('countryProfileSelect')?.addEventListener('change', (e) => {
  if (newPlateInput) {
        const lang = langSelect.value || "en";

        newPlateInput.placeholder = (e.target.value === "RO") 
            ? i18n[lang].placeholder_ro 
            : i18n[lang].placeholder_en;
    }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    currentMessageIndex = Math.floor(Math.random() * 11);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      const data = snapshot.data();

       nameInput.value = data.displayName || "";
if (data.displayName) {
    nameInput.value = data.displayName;
    showGreeting(data.displayName);
}

      if (Array.isArray(data.licensePlates)) {
        licensePlates = data.licensePlates;
      } else if (typeof data.licensePlate === "string" && data.licensePlate.trim() !== "") {
        licensePlates = [normalizePlate(data.licensePlate)];
        await updateDoc(userRef, { licensePlates });
      } else {
        licensePlates = [];
      }

      if (data.preferences) {
        const userLang = data.preferences.language || "en";
        langSelect.value = userLang;
        darkToggle.checked = data.preferences.theme === "dark";
        updatePageLanguage(userLang);
      }
    }

    renderPlates();
    await fetchAndRenderHistory(user.uid);
    applyTheme(darkToggle.checked);
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
  loadBookingHistory(user.uid);
});

function applyTheme(isDark) {
  const theme = isDark ? "dark" : "light";

  if (window.applyParkSibiuTheme) {
    window.applyParkSibiuTheme(theme);
    return;
  }

  localStorage.setItem("parkSibiuTheme", theme);
  document.documentElement.dataset.theme = theme;
  document.body.classList.toggle("dark-theme", isDark);
  document.body.classList.toggle("light-theme", !isDark);
}

function normalizePlate(value) {
  return value.replace(/\s+/g, "").toUpperCase();
}

async function persistLicensePlates() {
  const user = auth.currentUser;
  if (!user) return;
  const lang = langSelect.value || "en";
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, { 
      licensePlates: licensePlates 
    }, { merge: true });
    
    alert(i18n[lang].alert_plates_updated);
  } catch (err) {
    console.error("Failed to save license plates:", err);
    alert(i18n[lang].alert_plates_failed);
  }
}

function renderPlates() {
  if (!platesList) return;
  platesList.innerHTML = "";
  const lang = langSelect.value || "en";
  if (favoriteSelect) {
    favoriteSelect.innerHTML = lang === "ro" 
      ? '<option value=""> Selectează Plăcuța Favorită </option>' 
      : '<option value=""> Select Favorite Plate </option>';
  }

  if (licensePlates.length === 0) {
   platesList.innerHTML = `<li>${i18n[lang].no_plates}</li>`;
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
    removeBtn.textContent = lang === "ro" ? "Șterge" : "Remove";
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

function renderHistory(reservations) {
  const listEl = document.getElementById("reservationHistoryList");
  if (!listEl) return;

  listEl.innerHTML = "";
  const lang = langSelect.value || "en";

  if (reservations.length === 0) {
    listEl.innerHTML = `<li>${i18n[lang].no_bookings}</li>`;
    return;
  }

  reservations.forEach(res => {
    const li = document.createElement("li");

    const locale = lang === "ro" ? "ro-RO" : "en-US";
    const date = res.startTime.toDate().toLocaleDateString(locale);
    const time = res.startTime.toDate().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const connector = lang === "ro" ? "la" : "at";
    const unit = lang === "ro" ? "h" : "h"; 
    
    li.innerHTML = `
      <strong>${res.parkingName}</strong><br>
      <small>${date} ${connector} ${time} - ${res.durationHours}${unit}</small><br>
      <span style="float:right;">${res.totalCost} RON</span>
    `;
    listEl.appendChild(li);
  });
}

async function fetchAndRenderHistory(userId) {
  try {
    const q = query(
      collection(db, "reservations"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(20) 
    );

    const snapshot = await getDocs(q);
    const reservations = snapshot.docs.map(doc => doc.data());
    renderHistory(reservations);

  } catch (err) {
    console.error("Failed to fetch reservation history:", err);
    const listEl = document.getElementById("reservationHistoryList");
    const lang = langSelect.value || "en";
    if(listEl) listEl.innerHTML = `<li>${i18n[lang].error_history}</li>`;
  }
}

if (savePlateBtn) {
    savePlateBtn.addEventListener("click", async () => {
        const country = document.getElementById('countryProfileSelect').value;
        const raw = newPlateInput?.value?.trim() || "";
        const plate = normalizePlate(raw);
        if (!plate) return;

        const lang = langSelect.value || "en";

        const alphanumericRegex = /^[A-Z0-9]+$/;
        if (!alphanumericRegex.test(plate)) {
            return alert(i18n[lang].alert_plate_invalid_chars);
        }

        if (country === "RO") {
            if (!validateROPlate(plate)) {
              return alert(i18n[lang].alert_plate_invalid_ro);
            }
        } else {
            if (plate.length < 3 || plate.length > 14) {
              return alert(i18n[lang].alert_plate_length);
            }
        }
        if (licensePlates.includes(plate)) {
            alert(i18n[lang].alert_plate_exists);
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

  const currentLang = langSelect.value; 

  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      preferences: {
        language: currentLang,
        theme: darkToggle.checked ? "dark" : "light"
      }
    }, { merge: true });
    
    applyTheme(darkToggle.checked);
    updatePageLanguage(currentLang);
    renderPlates();
    loadBookingHistory(user.uid);
    if (auth.currentUser?.displayName) {
        showGreeting(auth.currentUser.displayName);
    }

  } catch (err) {
    console.error("Failed to save preferences:", err);
  }
}

langSelect.addEventListener("change", savePreferences);
darkToggle.addEventListener("change", savePreferences);
saveNameBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const newName = nameInput.value.trim();
  const lang = langSelect.value || "en";
  if (!newName) {
      alert(i18n[lang].alert_enter_name);
      return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, { displayName: newName }, { merge: true });
    
    showGreeting(newName); 
  } catch (err) {
    console.error("Failed to save name:", err);
    alert(i18n[lang].alert_name_failed);
  }
});


resetBtn.addEventListener("click", async () => {
  const lang = langSelect.value || "en";
  try {
    const email = auth.currentUser?.email;

    if (!email) {
      alert(i18n[lang].alert_no_email);
      return;
    }

    await sendPasswordResetEmail(auth, email);
    alert(i18n[lang].alert_reset_sent);
  } catch (err) {
    console.error("Password reset failed:", err);
    alert(i18n[lang].alert_reset_failed);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout failed:", err);
    const lang = langSelect.value || "en";
    alert(i18n[lang].alert_logout_failed);
  }
});

document.getElementById('saveFavoriteBtn')?.addEventListener('click', () => {
  const selectedFav = favoriteSelect.value;
  const lang = langSelect.value || "en";
  if (!selectedFav) return alert(i18n[lang].alert_plate_empty);
  
  localStorage.setItem('favoritePlate', selectedFav);
  const successMessage = lang === "ro" 
    ? `Plăcuța ${selectedFav} este acum favorita ta!` 
    : `Plate ${selectedFav} is now your favorite!`;

  alert(successMessage);
  renderPlates(); 
});
async function loadBookingHistory(userId) {
    const container = document.getElementById("bookingHistoryContainer");
    if (!container) return;
    const lang = langSelect.value || "en";
    try {
        const q = query(
            collection(db, "reservations"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc"),
            limit(20)
        );

        const querySnapshot = await getDocs(q);
        container.innerHTML = "";

        if (querySnapshot.empty) {
           container.innerHTML = `<p>${i18n[lang].no_bookings}</p>`;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const reservationId = docSnap.id;
            const statusClass = data.status === 'paid' ? '' : (data.status === 'cancelled' ? 'cancelled' : 'pending');
            const locale = lang === "ro" ? "ro-RO" : "en-US";
            const dateStr = data.createdAt?.toDate().toLocaleString(locale) || "N/A";

            const card = document.createElement("div");
            card.className = `booking-card ${statusClass}`;
            card.style.position = "relative";

          card.innerHTML = `
                <div style="margin-right: 35px;">
                    <strong>${data.parkingName || "Parking"}</strong><br>
                    ${i18n[lang].history_plate}: ${data.plateNumber}<br>
                    ${i18n[lang].history_time}: ${dateStr}<br>
                    ${i18n[lang].history_cost}: ${data.totalCost} RON | ${i18n[lang].history_status}: <strong>${data.status.toUpperCase()}</strong>
                </div>
            `;

            const actionContainer = document.createElement("div");
            actionContainer.style.cssText = "display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;";

            if (status === 'paid') {
                const pdfBtn = document.createElement("button");
                pdfBtn.innerText = "📄 Receipt";
                pdfBtn.className = "btn-download";
                pdfBtn.onclick = () => {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    doc.setFillColor(44, 62, 80);
                    doc.rect(0, 0, 210, 40, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(22);
                    doc.setFont("helvetica", "bold");
                    doc.text("PARK SIBIU", 105, 20, { align: "center" });
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "normal");
                    doc.text("OFFICIAL DIGITAL RECEIPT", 105, 30, { align: "center" });
                    doc.setTextColor(44, 62, 80);
                    doc.setFontSize(12);
                    doc.text(`Receipt ID: #${reservationId.substring(0, 8).toUpperCase()}`, 20, 55);
                    doc.text(`Date: ${new Date().toLocaleDateString('ro-RO')}`, 140, 55);
                    doc.setDrawColor(200, 200, 200);
                    doc.line(20, 60, 190, 60);
                    doc.setFont("helvetica", "bold");
                    doc.text("DESCRIPTION", 20, 75);
                    doc.text("DETAILS", 100, 75);
                    doc.setFont("helvetica", "normal");
                    doc.line(20, 78, 190, 78);
                    const rows = [
                        ["Parking Zone:", data.parkingName || "Public Parking"],
                        ["License Plate:", data.plateNumber],
                        ["Time of Entry:", dateStr],
                        ["Duration:", data.durationHours ? `${data.durationHours}h` : "N/A"],
                        ["Payment Status:", "PAID / SUCCESSFUL"]
                    ];
                    let y = 88;
                    rows.forEach(row => {
                        doc.text(row[0], 20, y);
                        doc.text(row[1], 100, y);
                        y += 10;
                    });
                    doc.setFillColor(248, 249, 250);
                    doc.rect(20, y + 5, 170, 20, 'F');
                    doc.setFontSize(16);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(52, 152, 219);
                    doc.text(`TOTAL PAID: ${data.totalCost} RON`, 105, y + 18, { align: "center" });
                    doc.setFontSize(9);
                    doc.setTextColor(150, 150, 150);
                    doc.setFont("helvetica", "italic");
                    doc.text("Thank you for using Park Sibiu. Safe travels!", 105, 280, { align: "center" });
                    doc.save(`ParkSibiu_Receipt_${data.plateNumber}.pdf`);
                };
                actionContainer.appendChild(pdfBtn);
            }

            if (status !== 'cancelled') {
                const cancelBtn = document.createElement("button");
                cancelBtn.innerText = "🚫 Cancel";
                cancelBtn.className = "btn-cancel";
                cancelBtn.onclick = async () => {
                    if (confirm("Are you sure you want to cancel this booking?")) {
                        try {
                            await updateDoc(doc(db, "reservations", reservationId), { status: 'cancelled' });
                            loadBookingHistory(userId);
                        } catch (err) {
                            console.error(err);
                            alert("Error cancelling booking.");
                        }
                    }
                };
                actionContainer.appendChild(cancelBtn);
            }

            card.querySelector('div').appendChild(actionContainer);

            const deleteBtn = document.createElement("button");
            deleteBtn.innerHTML = "&times;";
            deleteBtn.title = lang === "ro" ? "Șterge din istoric" : "Delete from history";
            deleteBtn.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: #ff4d4d;
                color: white;
                border: none;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                cursor: pointer;
                font-size: 16px;
                line-height: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: 0.3s;
            `;

            deleteBtn.onmouseover = () => deleteBtn.style.background = "#cc0000";
            deleteBtn.onmouseout = () => deleteBtn.style.background = "#ff4d4d";

            deleteBtn.onclick = async () => {
                if (confirm(i18n[lang].alert_confirm_delete_booking)) {
                    try {
                        await deleteDoc(doc(db, "reservations", reservationId));
                        card.remove(); 
                        if (container.children.length === 0) {
                            container.innerHTML = `<p>${i18n[lang].no_bookings}</p>`;
                        }
                    } catch (err) {
                        console.error("Error deleting reservation:", err);
                        alert(i18n[lang].alert_delete_booking_failed);
                    }
                }
            };

            card.appendChild(deleteBtn);
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Error loading history:", err);
        container.innerHTML = `<p>${i18n[lang].error_history}</p>`;
    }
}

// function showGreeting(name) {
//     const lang = langSelect.value || "en";
//     nameInputArea.style.display = "none";
//     greetingArea.innerText = `${i18n[lang].greeting_hello}, ${name}! 👋`;
//     greetingArea.style.display = "block";

//    const cuteMessages = [];
//     for (let i = 0; i < 10; i++) {
//         if (i18n[lang][`cute_msg_${i}`]) {
//             cuteMessages.push(i18n[lang][`cute_msg_${i}`]);
//         }
//     }

//     const randomMessage = cuteMessages[Math.floor(Math.random() * cuteMessages.length)];
//     subGreetingtext.innerText = randomMessage;
//     subGreetingtext.style.display = "block";
// }
function showGreeting(name) {
    const lang = langSelect.value || "en";
    const hello = i18n[lang].greeting_hello || "Hello";
    nameInputArea.style.display = "none";
    greetingArea.innerText = `${hello}, ${name}!`;
    greetingArea.style.display = "block";

    const selectedMessage = i18n[lang][`cute_msg_${currentMessageIndex}`] || i18n[lang][`cute_msg_0`];
    subGreetingtext.innerText = selectedMessage;
    subGreetingtext.style.display = "block";
}

if (newPlateInput) {
    newPlateInput.addEventListener("input", (e) => {
        const start = e.target.selectionStart;
        const sanitizedValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");      
        if (e.target.value !== sanitizedValue) {
            e.target.value = sanitizedValue;
            e.target.setSelectionRange(start, start);
        }
    });
}

function updatePageLanguage(lang) {
  localStorage.setItem('preferredLang', lang);

  const t = i18n[lang];
  if (!t) return;

  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.getAttribute("data-i18n");
    if (t[key]) element.textContent = t[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    const key = element.getAttribute("data-i18n-placeholder");
    if (t[key]) element.placeholder = t[key];
  });

  if (newPlateInput) {
    const countrySelect = document.getElementById('countryProfileSelect');
    const currentCountry = countrySelect ? countrySelect.value : "RO";
    newPlateInput.placeholder = (currentCountry === "RO") ? t.placeholder_ro : t.placeholder_en;
  }

  if (t.page_title) document.title = t.page_title;

  const currentName = nameInput?.value?.trim();
  if (currentName && greetingArea && greetingArea.style.display === "block") {
    showGreeting(currentName);
  }
}
const _initLang = localStorage.getItem('preferredLang') || (navigator.language.startsWith('ro') ? 'ro' : 'en');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updatePageLanguage(_initLang));
} else {
  updatePageLanguage(_initLang);
}