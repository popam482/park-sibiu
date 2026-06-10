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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

let currentPricePerHour = 0;
let selectedParking     = null;
let activeReservationId        = null;
let activeReservationParkingId = null;

window.activeReservationParkingId = activeReservationParkingId;

const DAILY_RATE = 15;

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
let autoReleaseInitialized = false;  // prevents duplicate listeners/intervals
let pollIntervalId         = null;   // keeps reference so we never double-register
const processingReservations = new Set(); 

// event listeners for filters and sorting in the parking list
document.getElementById('searchInput')?.addEventListener('input', applyFiltersAndRender);
document.getElementById('availableOnlyFilter')?.addEventListener('change', applyFiltersAndRender);
document.getElementById('nonStopFilter')?.addEventListener('change', applyFiltersAndRender);
document.getElementById('sortSelect')?.addEventListener('change', applyFiltersAndRender);

// auto release function for parkingspots that have expired 

// async function releaseExpiredSpot(reservationId, parkingId) {
//   if (!parkingId) {
//     console.warn(`Skipping release for ${reservationId} — no parkingId.`);
//     return;
//   }

//   if (processingReservations.has(reservationId)) return;
//   processingReservations.add(reservationId);

//   try {
//     const reservationRef = doc(db, "reservations", reservationId);
//     const parkingRef     = doc(db, "parkings", String(parkingId));

//     await runTransaction(db, async (tx) => {
//       const [resSnap, parkSnap] = await Promise.all([
//         tx.get(reservationRef),
//         tx.get(parkingRef)
//       ]);

//       if (!resSnap.exists() || resSnap.data().status !== "paid") return;
//       if (!parkSnap.exists()) return;

//       const currentFree = Number(parkSnap.data().freeSpots  || 0);
//       const total       = Number(parkSnap.data().totalSpots || 0);

//       tx.update(reservationRef, { status: "completed" });
//       if (currentFree < total) {
//         tx.update(parkingRef, { freeSpots: currentFree + 1 });
//       }
//     });

//     console.log(`Reservation ${reservationId} completed — spot released.`);
//   } catch (err) {
//     console.error(`Release failed [${reservationId}]:`, err.code, err.message);
//   } finally {
//     processingReservations.delete(reservationId);
//   }
// }
// Înlocuiește funcția releaseExpiredSpot cu aceasta pentru a curăța și LocalStorage
async function releaseExpiredSpot(reservationId, parkingId) {
  if (!parkingId) return;
  if (processingReservations.has(reservationId)) return;
  processingReservations.add(reservationId);

  try {
    const reservationRef = doc(db, "reservations", reservationId);
    const parkingRef     = doc(db, "parkings", String(parkingId));

    await runTransaction(db, async (tx) => {
      const [resSnap, parkSnap] = await Promise.all([
        tx.get(reservationRef),
        tx.get(parkingRef)
      ]);

      if (!resSnap.exists() || resSnap.data().status === "completed") return;
      if (!parkSnap.exists()) return;

      const currentFree = Number(parkSnap.data().freeSpots  || 0);
      const total       = Number(parkSnap.data().totalSpots || 0);

      tx.update(reservationRef, { status: "completed" });
      if (currentFree < total) {
        tx.update(parkingRef, { freeSpots: currentFree + 1 });
      }
    });

    let existingBookings = JSON.parse(localStorage.getItem('myBookingsList') || "[]");
    existingBookings = existingBookings.filter(b => String(b.id) !== String(reservationId));
    localStorage.setItem('myBookingsList', JSON.stringify(existingBookings));

    if (activeReservationId === reservationId) {
      activeReservationId = null;
      activeReservationParkingId = null;
      localStorage.removeItem('myBooking');
      localStorage.removeItem('activeReservationId');
      localStorage.removeItem('myBookingStatus');
    }

    if (typeof window.renderMarkers === "function") {
      window.renderMarkers(window.latestParkings);
    }

    console.log(`Reservation ${reservationId} expired and cleaned up.`);
  } catch (err) {
    console.error(`Release failed [${reservationId}]:`, err);
  } finally {
    processingReservations.delete(reservationId);
  }
}

document.getElementById("cancelBtn")?.addEventListener("click", async () => {

  const resId = activeReservationId || localStorage.getItem('activeReservationId');
  const parkId = activeReservationParkingId || localStorage.getItem('myBooking');

  if (!resId || !parkId) {
    alert("No active reservation found to cancel.");
    manageBox.style.display = "none";
    return;
  }

  if (!confirm("Are you sure you want to cancel your booking?")) return;

  try {
    const reservationRef = doc(db, "reservations", String(resId));
    const parkingRef     = doc(db, "parkings", String(parkId));

    await runTransaction(db, async (tx) => {
      const parkSnap = await tx.get(parkingRef);
      if (!parkSnap.exists()) throw new Error("Parking not found.");
      const currentFree = Number(parkSnap.data().freeSpots || 0);
      tx.update(parkingRef,     { freeSpots: currentFree + 1 });
      tx.update(reservationRef, { status: "cancelled" });
    });

    if (scheduledReleases.has(resId)) {
      clearTimeout(scheduledReleases.get(resId));
      scheduledReleases.delete(resId);
    }

    let existingBookings = JSON.parse(localStorage.getItem('myBookingsList') || "[]");
    existingBookings = existingBookings.filter(b => String(b.parkingId) !== String(parkId));
    localStorage.setItem('myBookingsList', JSON.stringify(existingBookings));

    localStorage.removeItem('myBooking'); 
    localStorage.removeItem('myBookingName'); 
    localStorage.removeItem('myBookingStatus');
    localStorage.removeItem('activeReservationId');
    localStorage.removeItem('myBookingEndTime');
    
    activeReservationId = null;
    activeReservationParkingId = null;
    window.activeReservationParkingId = null;

    manageBox.style.display = "none";
    alert("Reservation cancelled successfully.");
    
    location.reload();
  } catch (err) {
    console.error("Cancel error:", err);
    alert("Cancel failed: " + err.message);
  }
});

function scheduleSpotRelease(reservationId, parkingId, endTime) {
  if (scheduledReleases.has(reservationId)) return; // already scheduled this session

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
    const snap = await getDocs(query(
      collection(db, "reservations"),
      where("userId",  "==", userId),
      where("status",  "==", "paid"),
      where("endTime", "<=", Timestamp.now())
    ));
    if (!snap.empty) {
      console.log(`Poll: ${snap.size} expired reservation(s) found.`);
      snap.docs.forEach((d) => releaseExpiredSpot(d.id, String(d.data().parkingId || "")));
    }
  } catch (err) {
    console.error("Poll error:", err.code, err.message);
  }
}

// Called once when auth is confirmed, the flag ensures it never runs twice
function initAutoRelease(user) {
  if (autoReleaseInitialized) return;
  autoReleaseInitialized = true;

  onSnapshot(
    query(
      collection(db, "reservations"),
      where("userId", "==", user.uid),
      where("status", "==", "paid")
    ),
    (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.endTime && d.parkingId) scheduleSpotRelease(docSnap.id, String(d.parkingId), d.endTime);
      });
    },
    (err) => console.error("Reservation listener:", err.code, err.message)
  );

  pollMyExpiredReservations(user.uid);
  pollIntervalId = setInterval(() => pollMyExpiredReservations(user.uid), 60_000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pollMyExpiredReservations(user.uid);
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  initAutoRelease(user); 
});

// plate selection

async function loadUserCars(user) {
  const carSelect  = document.getElementById("carSelect");
  const plateInput = document.getElementById("plateNumber");
  if (!carSelect || !user) return;

  try {
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (!snapshot.exists()) return;

    const plates       = snapshot.data().licensePlates || [];
    const favoritePlate = localStorage.getItem("favoritePlate") || "";

    carSelect.innerHTML = "";
    const otherOpt = document.createElement("option");
    otherOpt.value = "OTHER";
    otherOpt.textContent = "-- Type a different plate --";
    carSelect.appendChild(otherOpt);

    const sorted = [...plates].sort((a, b) => (a === favoritePlate ? -1 : b === favoritePlate ? 1 : 0));
    sorted.forEach((plate) => {
      const opt = document.createElement("option");
      opt.value       = plate;
      opt.textContent = plate + (plate === favoritePlate ? " ⭐" : "");
      carSelect.appendChild(opt);
    });

    if (favoritePlate && plates.includes(favoritePlate)) {
      carSelect.value = favoritePlate;
      if (plateInput) { plateInput.value = favoritePlate; plateInput.readOnly = true; }
    } else if (sorted.length > 0) {
      carSelect.value = sorted[0];
      if (plateInput) { plateInput.value = sorted[0]; plateInput.readOnly = true; }
    } else {
      carSelect.value = "OTHER";
      if (plateInput) { plateInput.value = ""; plateInput.readOnly = false; }
    }

    carSelect.onchange = () => {
      if (!plateInput) return;
      if (carSelect.value === "OTHER") {
        plateInput.value = "";
        plateInput.readOnly = false;
        plateInput.focus();
      } else {
        plateInput.value    = carSelect.value;
        plateInput.readOnly = true;
      }
    };
  } catch (err) {
    console.error("Error loading plates:", err);
  }
}

// booking panel helpers

function setCurrentTimeDefault() {
  const timeInput = document.getElementById("startTime");
  if (!timeInput) return;
  const now = new Date();
  timeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function parseOpenHours(openHours) {
  if (!openHours || typeof openHours !== "string") return null;
  const parts = openHours.split("-").map(s => s.trim());
  if (parts.length < 2) return null;
  const [sh, sm] = parts[0].split(":").map(Number);
  let   [eh, em] = parts[1].split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return null;
  if (eh === 24) { eh = 0; em = 0; } // midnight
  return { openH: sh, openM: sm, closeH: eh, closeM: em };
}

// max bookable hours from a given startTime until parking closes 
function getMaxHours(startTimeValue, openHours) {
  const parsed = parseOpenHours(openHours);
  if (!parsed) return 24;

  const [sh, sm] = startTimeValue.split(":").map(Number);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0);

  let close;
  if (parsed.closeH === 0 && parsed.closeM === 0) {
    close = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  } else {
    close = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parsed.closeH, parsed.closeM, 0);
  }

  const diffHours = (close - start) / 3_600_000;
  return Math.max(1, Math.floor(diffHours));
}
function updateCostPreview() {
    const preview = document.getElementById("costPreview");
    const allDay = document.getElementById("allDayCheck")?.checked;
    const startTimeEl = document.getElementById("startTime");
    const durationEl = document.getElementById("duration");
    if (!preview) return;

    const pricePerHour = Number(currentPricePerHour || 0);
    let displayCost = 0;

    if (allDay && startTimeEl?.value) {
        const maxH = getMaxHours(startTimeEl.value, selectedParking.openHours);
        const hourlyTotal = maxH * pricePerHour;
        // Folosim aceeași logică de minim
        displayCost = Math.min(hourlyTotal, DAILY_RATE);
        preview.innerText = `Total: ${displayCost.toFixed(2)} RON (Best Rate Applied)`;
    } else {
        const hours = Number(durationEl?.value || 1);
        displayCost = hours * pricePerHour;
        preview.innerText = `Total: ${displayCost.toFixed(2)} RON`;
    }
}

async function openBookingPanel(parking) {
  const user = auth.currentUser;
  reservationPanel.style.display = "block";
  document.getElementById("panelTitle").innerText          = "Book a spot";
  document.getElementById("selectedParkingName").innerText = "Parking: " + parking.name;
  setCurrentTimeDefault();
  if (user) await loadUserCars(user);

  const startEl    = document.getElementById("startTime");
  const durationEl = document.getElementById("duration");
  const allDayEl   = document.getElementById("allDayCheck");

  const refreshMax = () => {
    if (!allDayEl?.checked && startEl?.value && selectedParking?.openHours) {
      const maxH = getMaxHours(startEl.value, selectedParking.openHours);
      if (durationEl) {
        durationEl.max   = maxH;
        if (Number(durationEl.value) > maxH) durationEl.value = maxH;
      }
    }
    updateCostPreview();
  };

  startEl?.addEventListener("change",    refreshMax);
  durationEl?.addEventListener("input",  refreshMax);

  allDayEl?.addEventListener("change", () => {
    const isAllDay = allDayEl.checked;
    if (durationEl) durationEl.disabled = isAllDay;
    if (isAllDay && startEl?.value && selectedParking?.openHours) {
      const maxH = getMaxHours(startEl.value, selectedParking.openHours);
      if (durationEl) durationEl.value = maxH;
    }
    updateCostPreview();
  });

  refreshMax();
}

// real time parking list and details updates

function renderParkingList(parkings) {
    const listElement = document.getElementById("parkingList");
    if (!listElement) return;
    
    listElement.innerHTML = ""; 

    if (parkings.length === 0) {
        listElement.innerHTML = '<li>No parkings match your criteria.</li>';
        return;
    }

    parkings.forEach((p) => {
        const isFull = p.freeSpots <= 0;
        const li = document.createElement("li");
        li.innerHTML = `
          <div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
            <b style="font-size:16px;">${p.name}</b><br>
            Status: <span style="color:${isFull ? "red" : "green"}; font-weight:bold;">
              ${isFull ? "Full" : "Available"}
            </span>
            <span style="float:right; color:#888; font-size:13px;">${p.pricePerHour} RON/h</span>
          </div>`;
        li.addEventListener("click", () => showParkingDetails(p));
        listElement.appendChild(li);
    });
}

export function refreshSelectedParkingFromLive(parkings) {
  if (!selectedParking?.id) return;
  const updated = parkings.find((p) => p.id === String(selectedParking.id));
  if (updated && parkingDetailsView.style.display !== "none") showParkingDetails(updated);
}

// parking details

function showParkingDetails(parking) {
  selectedParking     = parking;
  currentPricePerHour = parking.pricePerHour;
  const isFull        = parking.freeSpots <= 0;

    parkingListView.style.display    = "none";
    parkingDetailsView.style.display = "block";

  selectedParkingDetails.innerHTML = `
    <p><b>${parking.name}</b></p>
    <p>Status: <span style="color:${isFull ? "red" : "green"}; font-weight:bold;">
      ${isFull ? "Full" : "Available"}
    </span></p>
    <p>Location: Sibiu</p>
    <p>Spots: <b>${parking.freeSpots}</b> / ${parking.totalSpots}</p>
    <p>Price: ${parking.pricePerHour} RON/hour &nbsp;|&nbsp; All-day: ${DAILY_RATE} RON</p>
    <p>Hours: ${parking.openHours}</p>
    <button id="bookSelectedParkingBtn"
      style="width:100%; background:${isFull ? "#aaa" : "#007bff"}; color:white;
             border:none; padding:10px; border-radius:5px;
             cursor:${isFull ? "not-allowed" : "pointer"};"
      ${isFull ? "disabled" : ""}>
      ${isFull ? "Parking Full" : "Book Now"}
    </button>`;

  parkingListView.style.display    = "none";
  parkingDetailsView.style.display = "block";

  if (!isFull) {
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

closeParkingPanelBtn?.addEventListener("click", () => { parkingPanel.style.display = "none"; });

backToParkingListBtn?.addEventListener("click", () => {
  parkingListView.style.display    = "block";
  parkingDetailsView.style.display = "none";
});

document.getElementById("closePanel")?.addEventListener("click", () => {
  reservationPanel.style.display = "none";
  const allDayEl = document.getElementById("allDayCheck");
  if (allDayEl) allDayEl.checked = false;
  const durationEl = document.getElementById("duration");
  if (durationEl) { durationEl.disabled = false; durationEl.value = 1; }
});

window.showParkingDetailsFromMap = function (parking) {
  if (parkingPanel) parkingPanel.style.display = "block";
  showParkingDetails(parking);
};

//cancel booking
// document.getElementById("cancelBtn")?.addEventListener("click", async () => {
//   if (!confirm("Are you sure you want to cancel your booking?")) return;
//   try {
//     if (!activeReservationId || !activeReservationParkingId) {
//       manageBox.style.display = "none";
//       return;
//     }
//     const reservationRef = doc(db, "reservations", String(activeReservationId));
//     const parkingRef     = doc(db, "parkings", String(activeReservationParkingId));

//     await runTransaction(db, async (tx) => {
//       const parkSnap = await tx.get(parkingRef);
//       if (!parkSnap.exists()) throw new Error("Parking not found.");
//       const currentFree = Number(parkSnap.data().freeSpots || 0);
//       tx.update(parkingRef,     { freeSpots: currentFree + 1 });
//       tx.update(reservationRef, { status: "cancelled" });
//     });

//     if (scheduledReleases.has(activeReservationId)) {
//       clearTimeout(scheduledReleases.get(activeReservationId));
//       scheduledReleases.delete(activeReservationId);
//     }

//     let existingBookings = JSON.parse(localStorage.getItem('myBookingsList') || "[]");
//     existingBookings = existingBookings.filter(b => String(b.parkingId) !== String(activeReservationParkingId));
//     localStorage.setItem('myBookingsList', JSON.stringify(existingBookings));

//     activeReservationId = null;
//     activeReservationParkingId = null;
//     localStorage.removeItem('myBooking'); 
//     window.activeReservationParkingId = null;
//     localStorage.removeItem('myBookingName'); 
//     localStorage.removeItem('myBookingStatus');
//     localStorage.removeItem('activeReservationId');
//     localStorage.removeItem('myBookingEndTime');

//     if (typeof window.renderMarkers === "function") {
//         window.renderMarkers(window.latestParkings);
//     }
//     manageBox.style.display = "none";
//     alert("Reservation cancelled successfully.");
//     location.reload();
//   } catch (err) {
//     console.error(err);
//     alert(err.message || "Cancel failed.");
//   }
// });

// document.getElementById("editBtn")?.addEventListener("click", () => {
//   reservationPanel.style.display = "block";
//   document.getElementById("panelTitle").innerText = "Edit your time";
//   setCurrentTimeDefault();
// });

// confirm booking (creates reservation, updates parking availability with time limits, and shows manage box)

document.getElementById("confirmBooking")?.addEventListener("click", async () => {
  const parkingId = String(selectedParking?.id || "").trim();
  if (!parkingId) return alert("Invalid parking — select one from the list.");

  try {
    const user = auth.currentUser;
    if (!user) return alert("Please login first.");

    const timeChosen = document.getElementById("startTime")?.value;
    if (!timeChosen)  return alert("Please choose a start time.");

    const allDay    = document.getElementById("allDayCheck")?.checked || false;
    const plateInput = document.getElementById("plateNumber");
    const plateNumber = plateInput ? plateInput.value.replace(/\s+/g, "").toUpperCase() : "";
    if (!plateNumber) return alert("Please enter or select a license plate.");

    const [sh, sm] = timeChosen.split(":").map(Number);
    const now       = new Date();
    const bookingStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0);

    let hoursAmount, totalCost, bookingEnd;

    const maxH = selectedParking?.openHours
        ? getMaxHours(timeChosen, selectedParking.openHours)
        : 24;

    if (allDay) {
        hoursAmount = maxH;
        bookingEnd = new Date(bookingStart.getTime() + hoursAmount * 3_600_000);
        
        const hourlyTotal = hoursAmount * Number(currentPricePerHour || 0);
        
        if (hourlyTotal < DAILY_RATE) {
            totalCost = hourlyTotal;
            console.log("Applying hourly rate (cheaper than daily)");
        } else {
            totalCost = DAILY_RATE;
            console.log("Applying daily rate cap (15 RON)");
        }
    } else {
        hoursAmount = Number(document.getElementById("duration")?.value || 1);
        if (hoursAmount < 1) return alert("Duration must be at least 1 hour.");
        
        if (selectedParking?.openHours) {
            if (hoursAmount > maxH) return alert(`Maximum booking from ${timeChosen} is ${maxH} hour(s) for this parking.`);
        }

        totalCost = hoursAmount * Number(currentPricePerHour || 0);
        bookingEnd = new Date(bookingStart.getTime() + hoursAmount * 3_600_000);
    }

    const parkingRef = doc(db, "parkings", parkingId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(parkingRef);
      if (!snap.exists()) throw new Error("Parking not found.");
      const free = Number(snap.data().freeSpots || 0);
      if (free <= 0) throw new Error("No free spots available.");
      tx.update(parkingRef, { freeSpots: free - 1 });
    });

    const reservationDocRef = await addDoc(collection(db, "reservations"), {
      userId:        user.uid,
      parkingId,
      parkingName:   selectedParking.name,
      plateNumber,
      startTime:     Timestamp.fromDate(bookingStart),
      endTime:       Timestamp.fromDate(bookingEnd),
      durationHours: hoursAmount,
      isAllDay:      allDay,
      pricePerHour:  allDay ? null : Number(currentPricePerHour || 0),
      totalCost,
      status:        "pending_payment",
      createdAt:     Timestamp.now()
    });

    activeReservationId        = reservationDocRef.id;
    activeReservationParkingId = parkingId;

    const allDayEl = document.getElementById("allDayCheck");
    if (allDayEl) allDayEl.checked = false;
    const durationEl = document.getElementById("duration");
    if (durationEl) { durationEl.disabled = false; durationEl.value = 1; }

    manageBox.style.display = "flex";
    // resInfo.innerText = `${selectedParking.name} - ${timeChosen}, ${hoursAmount}h${allDay ? " (all-day)" : ""} - Plate: ${plateNumber}`;
    document.getElementById("costText").innerText      = `Total to pay: ${totalCost.toFixed(2)} RON`;
    document.getElementById("statusText").innerText    = "Status: NOT PAID";
    document.getElementById("statusText").style.color  = "blue";
    document.getElementById("payBtn").style.display    = "inline-block"; 
    localStorage.setItem('myBookingName', selectedParking.name);
    manageBox.style.display = "flex";
    reservationPanel.style.display = "none";
    parkingPanel.style.display     = "none";

    window.activeReservationParkingId = parkingId; 
    localStorage.setItem('myBooking', parkingId); 
    localStorage.setItem('activeReservationId', reservationDocRef.id);
    localStorage.setItem('myBookingEndTime', bookingEnd.toISOString());
    
    const existingBookings = JSON.parse(localStorage.getItem('myBookingsList') || "[]");

    const newBooking = {
        parkingId: parkingId,
        endTime: bookingEnd.toISOString(),
        id: reservationDocRef.id
    };

    const index = existingBookings.findIndex(b => b.parkingId === parkingId);
    if (index > -1) {
        existingBookings[index] = newBooking; 
    } else {
        existingBookings.push(newBooking); 
    }

    localStorage.setItem('myBookingsList', JSON.stringify(existingBookings));

    if (typeof window.renderMarkers === "function") {
        window.renderMarkers(window.latestParkings); 
    }
    
  } catch (err) {
    console.error("Booking error:", err);
    alert(err.message || "Booking failed.");
  }
});


// payment simulation (just updates reservation status to paid)

document.getElementById("payBtn")?.addEventListener("click", async () => {
  try {
    if (activeReservationId) {
      await updateDoc(doc(db, "reservations", String(activeReservationId)), { status: "paid" });
      localStorage.setItem('myBookingStatus', 'paid');
    }
    document.getElementById("statusText").innerText            = "Status: PAID";
    document.getElementById("statusText").style.color          = "green";
    document.getElementById("payBtn").style.display            = "none";
    document.getElementById("manageReservation").style.display = "none";
    alert("Payment successful! Thank you.");
    if (manageBox) manageBox.style.display = "none";

    if (typeof window.renderMarkers === "function") {
        window.renderMarkers(window.latestParkings);
    }
  } catch (err) {
    console.error(err);
    alert(err.message || "Payment update failed.");
  }
});
window.addEventListener('load', async () => {
    activeReservationId = localStorage.getItem('activeReservationId');
    activeReservationParkingId = localStorage.getItem('myBooking');
    const savedStatus = localStorage.getItem('myBookingStatus');
    
    window.activeReservationParkingId = activeReservationParkingId;

    let myBookings = JSON.parse(localStorage.getItem('myBookingsList') || "[]");
    
    if (myBookings.length > 0) {
    
        for (const booking of [...myBookings]) {
            try {
                const resSnap = await getDoc(doc(db, "reservations", booking.id));
             
                if (!resSnap.exists() || resSnap.data().status === "cancelled" || resSnap.data().status === "completed") {
                    myBookings = myBookings.filter(b => b.id !== booking.id);
                    
                    if (activeReservationId === booking.id) {
                        localStorage.removeItem('activeReservationId');
                        localStorage.removeItem('myBooking');
                        localStorage.removeItem('myBookingStatus');
                        activeReservationId = null;
                        activeReservationParkingId = null;
                    }
                }
            } catch (e) {
                console.error("Sync error for booking:", booking.id, e);
            }
        }
        localStorage.setItem('myBookingsList', JSON.stringify(myBookings));
    }

    if (activeReservationParkingId && savedStatus !== 'paid' && manageBox) {
        manageBox.style.display = "flex";
        document.getElementById("statusText").innerText = "Status: NOT PAID";
        document.getElementById("statusText").style.color = "blue";
    }

    setTimeout(() => {
        if (typeof window.renderMarkers === "function" && window.latestParkings.length > 0) {
            window.renderMarkers(window.latestParkings);
        }
    }, 1000); 
});

// filter and sort functions for the parking list
export function applyFiltersAndRender() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const availableOnly = document.getElementById('availableOnlyFilter').checked;
    const nonStopOnly = document.getElementById('nonStopFilter').checked;
    const sortBy = document.getElementById('sortSelect').value;

    if (!window.latestParkings) return;

    let filteredParkings = window.latestParkings;

    if (searchTerm) {
        filteredParkings = filteredParkings.filter(p => p.name.toLowerCase().includes(searchTerm));
    }

    if (availableOnly) {
        filteredParkings = filteredParkings.filter(p => p.freeSpots > 0);
    }

    if (nonStopOnly) {
        filteredParkings = filteredParkings.filter(p => p.openHours === "00:00-24:00");
    }

    if (sortBy === 'price-asc') {
        filteredParkings.sort((a, b) => a.pricePerHour - b.pricePerHour);
    } else if (sortBy === 'price-desc') {
        filteredParkings.sort((a, b) => b.pricePerHour - a.pricePerHour);
    }

    renderParkingList(filteredParkings);
}

window.cancelAnyReservation = async function(resId, parkId) {
    if (!confirm("Are you sure you want to cancel this specific booking?")) return;

    try {
        const reservationRef = doc(db, "reservations", String(resId));
        const parkingRef     = doc(db, "parkings", String(parkId));

        await runTransaction(db, async (tx) => {
            const parkSnap = await tx.get(parkingRef);
            if (!parkSnap.exists()) throw new Error("Parking not found.");
            
            const currentFree = Number(parkSnap.data().freeSpots || 0);
            tx.update(parkingRef,     { freeSpots: currentFree + 1 });
            tx.update(reservationRef, { status: "cancelled" });
        });

        let existingBookings = JSON.parse(localStorage.getItem('myBookingsList') || "[]");
        existingBookings = existingBookings.filter(b => String(b.id) !== String(resId));
        localStorage.setItem('myBookingsList', JSON.stringify(existingBookings));

        if (activeReservationId === resId) {
            localStorage.removeItem('activeReservationId');
            localStorage.removeItem('myBooking');
            activeReservationId = null;
            activeReservationParkingId = null;
        }

        alert("Reservation cancelled successfully.");
        location.reload(); // Refresh pentru a curăța harta
    } catch (err) {
        console.error("Cancel error:", err);
        alert("Could not cancel: " + err.message);
    }
};

//init

setCurrentTimeDefault();