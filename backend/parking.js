import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  addDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

let currentPricePerHour = 0;
let selectedParking = null;
let activeReservationId = null;      
let activeReservationParkingId = null;

const openParkingListBtn     = document.getElementById("openParkingListBtn");
const parkingPanel           = document.getElementById("parkingPanel");
const closeParkingPanelBtn   = document.getElementById("closeParkingPanelBtn");
const parkingListView        = document.getElementById("parkingListView");
const parkingDetailsView     = document.getElementById("parkingDetailsView");
const backToParkingListBtn   = document.getElementById("backToParkingListBtn");
const selectedParkingDetails = document.getElementById("selectedParkingDetails");
const reservationPanel       = document.getElementById("reservationPanel");
const manageBox              = document.getElementById("manageReservation");
const resInfo                = document.getElementById("resInfo");

const scheduledReleases = new Map();

// recalculate freeSpots for all parkings based on active reservations
async function forceResetAllFreeSpotsToTotal() {
  try {
    const parkingsSnap = await getDocs(collection(db, "parkings"));
    if (parkingsSnap.empty) {
      console.log("No parkings found.");
      return;
    }

    const batch = writeBatch(db);

    parkingsSnap.forEach((pDoc) => {
      const p = pDoc.data();
      const total = Number(p.totalSpots || 0);
      batch.update(doc(db, "parkings", pDoc.id), { freeSpots: total });
      console.log(`Reset ${pDoc.id}: freeSpots -> ${total}`);
    });

    await batch.commit();
    console.log("Force reset done.");
  } catch (e) {
    console.error("Force reset failed:", e);
  }
}

async function releaseExpiredSpot(reservationId, parkingId) {
  try {
    const reservationRef = doc(db, "reservations", reservationId);
    const parkingRef     = doc(db, "parkings", String(parkingId));

    await runTransaction(db, async (tx) => {
      const [resSnap, parkSnap] = await Promise.all([
        tx.get(reservationRef),
        tx.get(parkingRef)
      ]);

      if (!resSnap.exists() || resSnap.data().status !== "paid") return;
      if (!parkSnap.exists()) return;

      const currentFree = Number(parkSnap.data().freeSpots || 0);
      const total       = Number(parkSnap.data().totalSpots || 0);

      tx.update(reservationRef, { status: "completed" });
      if (currentFree < total) {
        tx.update(parkingRef, { freeSpots: currentFree + 1 });
      }
    });

    console.log(`Reservation ${reservationId} completed — spot released.`);
  } catch (err) {
    console.error(`Release failed for ${reservationId}:`, err.code, err.message);
  }
}

function scheduleSpotRelease(reservationId, parkingId, endTime) {
  if (scheduledReleases.has(reservationId)) return;
  const endMs   = endTime?.toMillis ? endTime.toMillis() : Number(endTime) * 1000;
  const delayMs = endMs - Date.now();

  if (delayMs <= 0) {
    releaseExpiredSpot(reservationId, parkingId);
    return;
  }
  const timer = setTimeout(() => {
    releaseExpiredSpot(reservationId, parkingId);
    scheduledReleases.delete(reservationId);
  }, delayMs);

  scheduledReleases.set(reservationId, timer);
  console.log(`Reservation ${reservationId} auto-releases in ${Math.round(delayMs / 1000)}s.`);
}

async function pollMyExpiredReservations(userId) {
  try {
    const now = Timestamp.now();
    const q   = query(
      collection(db, "reservations"),
      where("userId", "==", userId),
      where("endTime", "<=", now)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.parkingId) releaseExpiredSpot(d.id, String(data.parkingId));
    });
  } catch (err) {
    console.error("Poll error:", err.code, err.message);
  }
}

// Start everything once the program knows who the user is
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  onSnapshot(
    query(
      collection(db, "reservations"),
      where("userId", "==", user.uid),
      where("status", "==", "paid")
    ),
    (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.endTime && data.parkingId) {
          scheduleSpotRelease(docSnap.id, String(data.parkingId), data.endTime);
        }
      });
    },
    (err) => console.error("Reservation listener error:", err.code, err.message)
  );
  pollMyExpiredReservations(user.uid);
  setInterval(() => pollMyExpiredReservations(user.uid), 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pollMyExpiredReservations(user.uid);
  });
});

// license plates
async function getUserLicensePlates() {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    return snap.exists() ? (snap.data().licensePlates || []) : [];
  } catch {
    return [];
  }
}

function renderPlateSelector(plates) {
  const container = document.getElementById("plateSelectContainer");
  if (!container) return;

  if (plates.length === 0) {
    container.innerHTML = `
      <label style="font-size:13px;">License Plate:</label><br>
      <input type="text" id="plateValue" placeholder="e.g. SB01ABC"
        style="margin:6px 0; padding:6px; width:80%; text-transform:uppercase;">
      <small style="color:#888; display:block; margin-bottom:6px;">
        No saved plates — <a href="profile.html">add one in your profile</a>
      </small>`;
  } else {
    const options = plates.map(p => `<option value="${p}">${p}</option>`).join("");
    container.innerHTML = `
      <label style="font-size:13px;">License Plate:</label><br>
      <select id="plateValue" style="margin:6px 0; padding:6px; width:80%;">
        ${options}
      </select><br>`;
  }
}

// parking list and details
function setCurrentTimeDefault() {
  const timeInput = document.getElementById("startTime");
  if (!timeInput) return;
  const now = new Date();
  timeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

// function getStartAndEndDate(timeHHMM, durationHours) {
//   const now = new Date();
//   const [hh, mm] = timeHHMM.split(":").map(Number);
//   const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
//   const end   = new Date(start.getTime() + durationHours * 3_600_000);
//   return { start, end };
// }

function isNowInPaidInterval(openHours) {
  if (!openHours || typeof openHours !== "string") return true;

  const [startStr, endStr] = openHours.split("-").map(s => s.trim());
  if (!startStr || !endStr) return true;

  let [sh, sm] = startStr.split(":").map(Number);
  let [eh, em] = endStr.split(":").map(Number);

  if ([sh, sm, eh, em].some(Number.isNaN)) return true;

  if (eh === 24) { eh = 0; em = 0; }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  if (startStr === "00:00" && endStr === "24:00") return true;
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;

  return nowMin >= startMin || nowMin < endMin;
}

async function openBookingPanel(parking) {
  reservationPanel.style.display = "block";
  document.getElementById("panelTitle").innerText = "Book a spot";
  document.getElementById("selectedParkingName").innerText = "Parking: " + parking.name;
  setCurrentTimeDefault();

  if (auth.currentUser) {
    await loadUserCars(auth.currentUser);
  } else {
    const carSelect = document.getElementById("carSelect");
    if (carSelect) carSelect.innerHTML = '<option value="">Login to see cars</option>';
  }

}
// real time parking list and details
window.renderParkingListFromLive = function (parkings) {
  const listElement = document.getElementById("parkingList");
  if (!listElement) return;
  listElement.innerHTML = "";

  parkings.forEach((p) => {
    const isFull = p.freeSpots <= 0;
    const li = document.createElement("li");
    li.innerHTML = `
      <div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
        <b style="font-size:16px;">${p.name}</b><br>
        Status: <span style="color:${isFull ? "red" : "green"}; font-weight:bold;">
          ${isFull ? "Full" : "Available"}
        </span>
        <span style="float:right; color:#888; font-size:13px;">${p.freeSpots}/${p.totalSpots} spots</span>
      </div>`;
    li.addEventListener("click", () => showParkingDetails(p));
    listElement.appendChild(li);
  });
};

window.refreshSelectedParkingFromLive = function (parkings) {
  if (!selectedParking?.id) return;
  const updated = parkings.find((p) => p.id === String(selectedParking.id));
  if (updated && parkingDetailsView.style.display !== "none") {
    showParkingDetails(updated);
  }
};

// parking details
function showParkingDetails(parking) {
  selectedParking     = parking;
  currentPricePerHour = parking.pricePerHour;

  const isFull = parking.freeSpots <= 0;
  const paidNow = isNowInPaidInterval(parking.openHours);
  const canBook = !isFull && paidNow;

  selectedParkingDetails.innerHTML = `
    <p><b>${parking.name}</b></p>
    <p>Status: <span style="color:${isFull ? "red" : "green"}; font-weight:bold;">
      ${isFull ? "Full" : "Available"}
    </span></p>
    <p>Location: Sibiu</p>
    <p>Spots: <b>${parking.freeSpots}</b> / ${parking.totalSpots}</p>
    <p>Price: ${parking.pricePerHour} RON/hour</p>
    <p>Hours: ${parking.openHours}</p>
    <button id="bookSelectedParkingBtn"
      style="width:100%; background:${canBook ? "#007bff" : "#aaa"}; color:white;
             border:none; padding:10px; border-radius:5px;
             cursor:${canBook ? "pointer" : "not-allowed"};"
      ${canBook ? "" : "disabled"}>
      ${isFull ? "Parking Full" : (paidNow ? "Book Now" : "Outside paid hours")}
    </button>
    ${!paidNow ? `<p style="margin-top:8px; color:#666;">Booking with payment is available only in interval ${parking.openHours}.</p>` : ""}
  `;

  parkingListView.style.display    = "none";
  parkingDetailsView.style.display = "block";

  if (canBook) {
    document.getElementById("bookSelectedParkingBtn")
      ?.addEventListener("click", () => openBookingPanel(parking));
  }

  if (window.map?.flyTo && parking.lat != null && parking.lng != null) {
    window.map.flyTo([parking.lat, parking.lng], 16);
  }
}

// controls
openParkingListBtn?.addEventListener("click", () => {
  parkingPanel.style.display       = "block";
  parkingListView.style.display    = "block";
  parkingDetailsView.style.display = "none";
});

closeParkingPanelBtn?.addEventListener("click", () => {
  parkingPanel.style.display = "none";
});

backToParkingListBtn?.addEventListener("click", () => {
  parkingListView.style.display    = "block";
  parkingDetailsView.style.display = "none";
});

document.getElementById("closePanel")?.addEventListener("click", () => {
  reservationPanel.style.display = "none";
});

window.showParkingDetailsFromMap = function (parking) {
  if (parkingPanel) parkingPanel.style.display = "block";
  showParkingDetails(parking);
};


document.getElementById("cancelBtn")?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to cancel your booking?")) return;
  try {
    if (!activeReservationId || !activeReservationParkingId) {
      manageBox.style.display = "none";
      return;
    }

    const reservationRef = doc(db, "reservations", String(activeReservationId));
    const parkingRef     = doc(db, "parkings", String(activeReservationParkingId));

    await runTransaction(db, async (tx) => {
      const parkingSnap = await tx.get(parkingRef);
      if (!parkingSnap.exists()) throw new Error("Parking not found.");
      const currentFree = Number(parkingSnap.data().freeSpots || 0);
      tx.update(parkingRef, { freeSpots: currentFree + 1 });
      tx.update(reservationRef, { status: "cancelled" });
    });

    if (scheduledReleases.has(activeReservationId)) {
      clearTimeout(scheduledReleases.get(activeReservationId));
      scheduledReleases.delete(activeReservationId);
    }

    activeReservationId        = null;
    activeReservationParkingId = null;
    manageBox.style.display    = "none";
    alert("Reservation cancelled successfully.");
  } catch (err) {
    console.error(err);
    alert(err.message || "Cancel failed.");
  }
});

document.getElementById("editBtn")?.addEventListener("click", () => {
  reservationPanel.style.display = "block";
  document.getElementById("panelTitle").innerText = "Edit your time";
  setCurrentTimeDefault();
});

document.getElementById("confirmBooking")?.addEventListener("click", async () => {
    try {
        const user = auth.currentUser;
        const parkingId = String(selectedParking?.id || "").trim();

        if (!user) return alert("Please login first.");
        if (!parkingId) return alert("Please select a parking first.");

        if (typeof isNowInPaidInterval === "function" && !isNowInPaidInterval(selectedParking.openHours)) {
            return alert(`Parking is outside paid hours (${selectedParking.openHours}). Booking is disabled now.`);
        }

        const timeChosen = document.getElementById("startTime")?.value;
        const hoursAmount = Number(document.getElementById("duration")?.value || 1);
        const plateRaw = document.getElementById("plateNumber")?.value || ""; 
        const plateNumber = plateRaw.replace(/\s+/g, "").toUpperCase();
        const country = document.getElementById("countrySelect")?.value;

   
        if (!timeChosen || hoursAmount < 1 || !plateNumber) {
            return alert("Please fill in all details and choose a valid duration.");
        }

    const alphanumericRegex = /^[A-Z0-9]+$/;
        if (!alphanumericRegex.test(plateNumber)) {
            return alert("ERROR: License plate must contain only LETTERS and NUMBERS (no dots, spaces, or symbols).");
        }

     
        if (country === "RO") {
            const regexRO = /^(B\d{2,3}[A-Z]{3})$|^([A-Z]{2}\d{2}[A-Z]{3})$/;
            if (!regexRO.test(plateNumber)) {
                return alert("INVALID FORMAT! For Romania use: SB12ABC or B123ABC");
            }
        } else {
            if (plateNumber.length < 3 || plateNumber.length > 14) {
                return alert("Plate number is too short or too long (3-14 characters).");
            }
        }

        const totalCost = hoursAmount * Number(currentPricePerHour || 0);
        const { start, end } = getStartAndEndDate(timeChosen, hoursAmount);
        const parkingRef = doc(db, "parkings", parkingId);

       
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(parkingRef);
            if (!snap.exists()) throw new Error("Parking not found.");

            const free = Number(snap.data().freeSpots || 0);
            if (free <= 0) throw new Error("No free spots available.");

            tx.update(parkingRef, { freeSpots: free - 1 });
        });

       
        const reservationRef = await addDoc(collection(db, "reservations"), {
            userId: user.uid,
            parkingId: selectedParking.id,
            parkingName: selectedParking.name,
            plateNumber: plateNumber,
            startTime: Timestamp.fromDate(start),
            endTime: Timestamp.fromDate(end),
            durationHours: hoursAmount,
            totalCost: totalCost,
            status: "pending_payment",
            createdAt: Timestamp.now()
        });

        activeReservationId = reservationRef.id;
        activeReservationParkingId = selectedParking.id;

   
        manageBox.style.display = "flex";
        resInfo.innerText = `Reserved: ${plateNumber} at ${timeChosen} for ${hoursAmount}h — ${selectedParking.name}`;
        
        document.getElementById("costText").innerText = `Total to pay: ${totalCost} RON`;
        document.getElementById("statusText").innerText = "Status: NOT PAID";
        document.getElementById("statusText").style.color = "blue";
        document.getElementById("payBtn").style.display = "inline-block";

        reservationPanel.style.display = "none";
        parkingPanel.style.display = "none";

        if (parkingDetailsView) parkingDetailsView.style.display = "none";
        if (parkingListView) parkingListView.style.display = "block";

        alert("Reservation created! Please pay to finalize.");

    } catch (err) {
        console.error("Booking error:", err);
        alert(err.message || "Booking failed.");
    }
});
function getStartAndEndDate(timeHHMM, durationHours) {
  const now = new Date();
  const [hh, mm] = timeHHMM.split(":").map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  return { start, end };
}

document.getElementById("payBtn")?.addEventListener("click", async () => {
  try {
    if (activeReservationId) {
      await updateDoc(doc(db, "reservations", String(activeReservationId)), { status: "paid" });
    }

    document.getElementById("statusText").innerText = "Status: PAID";
    document.getElementById("statusText").style.color = "green";
    document.getElementById("payBtn").style.display = "none";
    document.getElementById("manageReservation").style.display = "none";

    alert("Payment successful! Thank you.");
  } catch (err) {
    console.error(err);
    alert(err.message || "Payment update failed.");
  }
});


async function loadParkings() {
  const listElement = document.getElementById("parkingList");
  if (!listElement) return;

  try {
    const dataFromFirebase = await getDocs(collection(db, "parkings"));
    listElement.innerHTML = "";

    dataFromFirebase.forEach((docSnap) => {
      const p = { ...docSnap.data(), id: docSnap.id };
      const li = document.createElement("li");
      li.innerHTML = `
        <div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
          <b style="font-size:16px;">${p.name}</b><br>
          Status: <span style="color:${p.freeSpots > 0 ? "green" : "red"}; font-weight:bold;">${p.freeSpots > 0 ? "Available" : "Full"}</span>
        </div>`;
      li.addEventListener("click", () => showParkingDetails(p));
      listElement.appendChild(li);
    });
  } catch (error) {
    console.log("Error loading parkings:", error);
  }
}

window.showParkingDetailsFromMap = function (parking) {
  if (parkingPanel) parkingPanel.style.display = "block";
  showParkingDetails(parking); 
};

async function loadUserCars(user) {
  const carSelect = document.getElementById("carSelect");
  const plateInput = document.getElementById("plateNumber");
  
  if (!carSelect || !user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      const plates = data.licensePlates || [];
      const favoritePlate = localStorage.getItem('favoritePlate') || "";

      carSelect.innerHTML = ""; 

      const otherOpt = document.createElement("option");
      otherOpt.value = "OTHER";
      otherOpt.textContent = "-- Choose another license plate --";
      carSelect.appendChild(otherOpt);

      const sortedPlates = [...plates].sort((a, b) => (a === favoritePlate ? -1 : b === favoritePlate ? 1 : 0));

      sortedPlates.forEach(plate => {
        const option = document.createElement("option");
        option.value = plate;
        option.textContent = plate + (plate === favoritePlate ? " ⭐" : "");
        carSelect.appendChild(option);
      });

      const currentFav = localStorage.getItem('favoritePlate');
      if (currentFav && plates.includes(currentFav)) {
        carSelect.value = currentFav;
        if(plateInput) { plateInput.value = currentFav; plateInput.readOnly = true; }
      } else if (sortedPlates.length > 0) {
        carSelect.value = sortedPlates[0];
        if(plateInput) { plateInput.value = sortedPlates[0]; plateInput.readOnly = true; }
      } else {
        carSelect.value = "OTHER";
        if(plateInput) { plateInput.value = ""; plateInput.readOnly = false; }
      }

      carSelect.onchange = () => {
        if (!plateInput) return;
        if (carSelect.value === "OTHER") {
          plateInput.value = "";
          plateInput.readOnly = false; 
          plateInput.focus();
        } else {
          plateInput.value = carSelect.value;
          plateInput.readOnly = true; 
        }
      };
    }
  } catch (err) {
    console.error("Error loading cars:", err);
  }
}

async function refreshSelectedParkingDetails() {
  if (!selectedParking?.id) return;

  try {
    const dataFromFirebase = await getDocs(collection(db, "parkings"));
    let updated = null;

    dataFromFirebase.forEach((docSnap) => {
      if (docSnap.id === String(selectedParking.id)) {
        updated = { ...docSnap.data(), id: docSnap.id };
      }
    });

    if (updated) {
      showParkingDetails(updated);
    }
  } catch (err) {
    console.error("Failed to refresh selected parking details:", err);
  }
}
document.getElementById('countrySelect')?.addEventListener('change', (e) => {
  const plateInput = document.getElementById('plateNumber');
  if (!plateInput) return;
  
  if (e.target.value === "RO") {
    plateInput.placeholder = "Ex: SB12ABC";
  } else {
    plateInput.placeholder = "Up to 14 characters";
  }
});


// const plateField = document.getElementById("plateNumber");
// if (plateField) {
//     plateField.addEventListener("input", (e) => {
//         const cursorPosition = e.target.selectionStart;

//         const sanitizedValue = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
        
//         if (e.target.value !== sanitizedValue) {
//             e.target.value = sanitizedValue;
//             e.target.setSelectionStart(cursorPosition - 1);
//             e.target.setSelectionEnd(cursorPosition - 1);
//         }
//     });
// }


const plateField = document.getElementById("plateNumber");
if (plateField) {
    plateField.addEventListener("input", (e) => {
        const start = e.target.selectionStart;

        const sanitizedValue = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        
        if (e.target.value !== sanitizedValue) {
            e.target.value = sanitizedValue;
            const newCursorPos = Math.max(0, start); 
            e.target.setSelectionRange(newCursorPos, newCursorPos);
        }
    });
}
setCurrentTimeDefault();
// forceResetAllFreeSpotsToTotal();
