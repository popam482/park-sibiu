import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  addDoc,
  updateDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

let currentPricePerHour = 0;
let selectedParking = null;
let activeReservationId = null;      
let activeReservationParkingId = null;

const openParkingListBtn = document.getElementById("openParkingListBtn");
const parkingPanel = document.getElementById("parkingPanel");
const closeParkingPanelBtn = document.getElementById("closeParkingPanelBtn");
const parkingListView = document.getElementById("parkingListView");
const parkingDetailsView = document.getElementById("parkingDetailsView");
const backToParkingListBtn = document.getElementById("backToParkingListBtn");
const selectedParkingDetails = document.getElementById("selectedParkingDetails");

const reservationPanel = document.getElementById("reservationPanel");
const manageBox = document.getElementById("manageReservation");
const resInfo = document.getElementById("resInfo");


function setCurrentTimeDefault() {
  const timeInput = document.getElementById("startTime");
  if (!timeInput) return;
  const now = new Date();
  timeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

openParkingListBtn?.addEventListener("click", () => {
  parkingPanel.style.display = "block";
  parkingListView.style.display = "block";
  parkingDetailsView.style.display = "none";
});

closeParkingPanelBtn?.addEventListener("click", () => {
  parkingPanel.style.display = "none";
});

backToParkingListBtn?.addEventListener("click", () => {
  parkingListView.style.display = "block";
  parkingDetailsView.style.display = "none";
});

document.getElementById("closePanel")?.addEventListener("click", () => {
  reservationPanel.style.display = "none";
});

document.getElementById("cancelBtn")?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to cancel your booking?")) return;

  try {
    if (!activeReservationId || !activeReservationParkingId) {
      manageBox.style.display = "none";
      return;
    }

    const reservationRef = doc(db, "reservations", String(activeReservationId));
    const parkingRef = doc(db, "parkings", String(activeReservationParkingId));

    await runTransaction(db, async (tx) => {
      const parkingSnap = await tx.get(parkingRef);
      if (!parkingSnap.exists()) throw new Error("Parking not found.");

      const currentFree = Number(parkingSnap.data().freeSpots || 0);
      tx.update(parkingRef, { freeSpots: currentFree + 1 });
      tx.update(reservationRef, { status: "cancelled" });
    });

    activeReservationId = null;
    activeReservationParkingId = null;
    manageBox.style.display = "none";
    alert("Reservation cancelled successfully.");

    await loadParkings();
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
    const user = auth.currentUser;
    const parkingId = String(selectedParking?.id || "").trim();
    
    const timeChosen = document.getElementById("startTime")?.value;
    const hoursAmount = Number(document.getElementById("duration")?.value || 1);
    const plateRaw = document.getElementById("plateNumber")?.value || "";
    const plateNumber = plateRaw.replace(/\s+/g, "").toUpperCase();
    const country = document.getElementById("countrySelect")?.value;

    if (!user) return alert("Please login first.");
    if (!parkingId) return alert("Please select a parking first.");
    if (!timeChosen || !plateNumber) return alert("Fill in all details.");
    if (!plateNumber) return alert("Please enter or select a license plate.");
  if (country === "RO") {
    const regexRO = /^(B\d{2,3}[A-Z]{3})$|^([A-Z]{2}\d{2}[A-Z]{3})$/;
    if (!regexRO.test(plateNumber)) {
        return alert("INVALID FORMAT! For Romania use: SB12ABC or B123ABC (București)");
    }
} else {
    if (plateNumber.length < 3 || plateNumber.length > 14) {
        return alert("Plate number is too short or too long.");
    }
}

    try {
        const totalCost = hoursAmount * (currentPricePerHour || 0);
        const { start, end } = getStartAndEndDate(timeChosen, hoursAmount);

        const parkingRef = doc(db, "parkings", parkingId);
        await updateDoc(parkingRef, {
            freeSpots: selectedParking.freeSpots - 1
        });

        const reservationRef = await addDoc(collection(db, "reservations"), {
            userId: user.uid,
            parkingName: selectedParking.name,
            startTime: Timestamp.fromDate(start),
            endTime: Timestamp.fromDate(end),
            plateNumber: plateNumber,
            totalCost: totalCost,
            status: "pending_payment",
            createdAt: Timestamp.now()
        });

        activeReservationId = reservationRef.id;
        activeReservationParkingId = selectedParking.id;

        manageBox.style.display = "flex";
        resInfo.innerText = `Reserved: ${plateNumber} at ${timeChosen}`;
        document.getElementById("costText").innerText = `Total to pay: ${totalCost} RON`;
        document.getElementById("statusText").innerText = "Status: NOT PAID";
        document.getElementById("statusText").style.color = "blue";
        document.getElementById("payBtn").style.display = "inline-block";

        reservationPanel.style.display = "none";
        parkingPanel.style.display = "none";

        await loadParkings();
    } catch (err) {
        console.error(err);
        alert(err.message);
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
      const reservationRef = doc(db, "reservations", String(activeReservationId));
      await updateDoc(reservationRef, { status: "paid" });
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

function showParkingDetails(parking) {
  selectedParking = parking;
  currentPricePerHour = parking.pricePerHour;

  selectedParkingDetails.innerHTML = `
    <p><b>${parking.name}</b></p>
    <p>Status: <span style="color:${parking.freeSpots > 0 ? "green" : "red"}; font-weight:bold;">${parking.freeSpots > 0 ? "Available" : "Full"}</span></p>
    <p>Location: Sibiu</p>
    <p>Spots: ${parking.freeSpots} / ${parking.totalSpots}</p>
    <p>Price: ${parking.pricePerHour} RON/hour</p>
    <p>Hours: ${parking.openHours}</p>
    <button id="bookSelectedParkingBtn" style="width:100%; background:#007bff; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">Book Now</button>
  `;

  parkingListView.style.display = "none";
  parkingDetailsView.style.display = "block";

  document.getElementById("bookSelectedParkingBtn")?.addEventListener("click", async () => {
    reservationPanel.style.display = "block";
    document.getElementById("panelTitle").innerText = "Book a spot";
    document.getElementById("selectedParkingName").innerText = "Parking: " + parking.name;
    setCurrentTimeDefault();

    if (auth.currentUser) {
      await loadUserCars(auth.currentUser);
    }

    const carSelect = document.getElementById("carSelect");
    const plateInput = document.getElementById("plateNumber");

    if (carSelect && plateInput) {
      const selectedValue = carSelect.value;

      if (selectedValue === "OTHER") {
        plateInput.value = "";
        plateInput.readOnly = false;
      } else {
        plateInput.value = selectedValue;
        plateInput.readOnly = true;
      }
    }
  });

  if (
    window.map &&
    typeof window.map.flyTo === "function" &&
    parking.lat != null &&
    parking.lng != null
  ) {
    window.map.flyTo([parking.lat, parking.lng], 16);
  }
}
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
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadUserCars(user);
    loadParkings(); 
  } else {
    const carSelect = document.getElementById("carSelect");
    const plateInput = document.getElementById("plateNumber");
    if(carSelect) carSelect.innerHTML = '<option value="OTHER">Login to see cars</option>';
    if(plateInput) { plateInput.value = ""; plateInput.readOnly = false; }
    loadParkings(); 
  }
});
setCurrentTimeDefault();
loadParkings();