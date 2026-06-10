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
    await fetchAndRenderHistory(user.uid);
    applyTheme(darkToggle.checked);
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
  loadBookingHistory(user.uid);
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

function renderHistory(reservations) {
  const listEl = document.getElementById("reservationHistoryList");
  if (!listEl) return;

  listEl.innerHTML = "";

  if (reservations.length === 0) {
    listEl.innerHTML = "<li>No reservations found in your history.</li>";
    return;
  }

  reservations.forEach(res => {
    const li = document.createElement("li");
    const date = res.startTime.toDate().toLocaleDateString('ro-RO');
    const time = res.startTime.toDate().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    
    li.innerHTML = `
      <strong>${res.parkingName}</strong><br>
      <small>${date} at ${time} - ${res.durationHours}h</small><br>
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
    if(listEl) listEl.innerHTML = "<li>Could not load history.</li>";
  }
}

if (savePlateBtn) {
    savePlateBtn.addEventListener("click", async () => {
        const country = document.getElementById('countryProfileSelect').value;
        const raw = newPlateInput?.value?.trim() || "";
        const plate = normalizePlate(raw);
        if (!plate) return;
        const alphanumericRegex = /^[A-Z0-9]+$/;
        if (!alphanumericRegex.test(plate)) {
            return alert("ERROR: License plate must contain only LETTERS and NUMBERS (no dots, symbols, or spaces).");
        }

        if (country === "RO") {
            if (!validateROPlate(plate)) {
                return alert("INVALID FORMAT! For Romania use: SB12ABC or B123ABC");
            }
        } else {
            if (plate.length < 3 || plate.length > 14) {
                return alert("Plate number is too short or too long (3-14 characters).");
            }
        }
        if (licensePlates.includes(plate)) {
            alert("This license plate is already in your list.");
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
async function loadBookingHistory(userId) {
    const container = document.getElementById("bookingHistoryContainer");
    if (!container) return;

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
            container.innerHTML = "<p>No bookings found.</p>";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const reservationId = docSnap.id;
            const status = data.status || "pending";
            const statusClass = status === 'paid' ? '' : (status === 'cancelled' ? 'cancelled' : 'pending');
            const dateStr = data.createdAt?.toDate().toLocaleString('ro-RO') || "N/A";

            const card = document.createElement("div");
            card.className = `booking-card ${statusClass}`;
            card.style.position = "relative";

            card.innerHTML = `
                <div style="margin-right: 35px;">
                    <strong>${data.parkingName || "Parking"}</strong><br>
                    Plate: ${data.plateNumber}<br>
                    Time: ${dateStr}<br>
                    Cost: ${data.totalCost} RON | Status: <strong>${status.toUpperCase()}</strong>
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
            deleteBtn.className = "btn-delete-small";
            deleteBtn.onclick = async () => {
                if (confirm("Are you sure you want to delete this booking from history?")) {
                    try {
                        await deleteDoc(doc(db, "reservations", reservationId));
                        card.remove();
                        if (container.children.length === 0) container.innerHTML = "<p>No bookings found.</p>";
                    } catch (err) {
                        console.error(err);
                    }
                }
            };

            card.appendChild(deleteBtn);
            container.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading history.</p>";
    }
}
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
function generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(40, 116, 166);
    doc.text("PARK SIBIU - DIGITAL RECEIPT", 105, 20, null, "center");
    
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date of Issue: ${new Date().toLocaleString()}`, 20, 35);
    doc.text(`Transaction ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 20, 42);

    doc.setFontSize(14);
    doc.text("Parking Details:", 20, 60);
    doc.setFontSize(12);
    doc.text(`Location: ${data.parkingName || 'Sibiu Public Parking'}`, 30, 70);
    doc.text(`License Plate: ${data.plateNumber}`, 30, 77);
    doc.text(`Booking Date: ${data.dateStr}`, 30, 84);
    
    doc.setDrawColor(200, 200, 200);
    doc.rect(20, 95, 170, 20);
    doc.setFontSize(16);
    doc.text(`TOTAL PAID: ${data.totalCost} RON`, 105, 108, null, "center");

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for using Park Sibiu! Keep this for your records.", 105, 130, null, "center");
    doc.save(`Receipt_${data.plateNumber}_${data.reservationId}.pdf`);
}