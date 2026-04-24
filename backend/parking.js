import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { setLanguage, i18n } from './translations.js';

let currentPricePerHour = 0;
let selectedParking = null;

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

document.getElementById("cancelBtn")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to cancel your booking?")) {
    manageBox.style.display = "none";
    alert("Reservation cancelled successfully.");
  }
});

document.getElementById("editBtn")?.addEventListener("click", () => {
  reservationPanel.style.display = "block";
  document.getElementById("panelTitle").innerText = "Edit your time";
  setCurrentTimeDefault();
});

document.getElementById("confirmBooking")?.addEventListener("click", () => {
  const timeChosen = document.getElementById("startTime")?.value;
  const hoursAmount = Number(document.getElementById("duration")?.value || 1);
  if (!timeChosen) return;

  const totalCost = hoursAmount * currentPricePerHour;

  manageBox.style.display = "flex";
  resInfo.innerText = `Reserved at ${timeChosen} for ${hoursAmount} hours.${selectedParking ? " (" + selectedParking.name + ")" : ""}`;
  document.getElementById("costText").innerText = `Total to pay: ${totalCost} RON`;
  document.getElementById("statusText").innerText = "Status: NOT PAID";
  document.getElementById("statusText").style.color = "blue";
  document.getElementById("payBtn").style.display = "inline-block";

  reservationPanel.style.display = "none";
  parkingPanel.style.display = "none";
});

document.getElementById("payBtn")?.addEventListener("click", () => {
  alert("Payment successful! Thank you.");
  document.getElementById("statusText").innerText = "Status: PAID";
  document.getElementById("statusText").style.color = "green";
  document.getElementById("payBtn").style.display = "none";
  document.getElementById("manageReservation").style.display = "none";
});

function showParkingDetails(parking) {
  const lang = localStorage.getItem('preferredLang') || 'en';
  selectedParking = parking;
  currentPricePerHour = parking.pricePerHour;

  selectedParkingDetails.innerHTML = `
    <p><b>${parking.name}</b></p>
    <p>${i18n[lang].label_status || "Status"}: <span style="color:${parking.freeSpots > 0 ? "green" : "red"}; font-weight:bold;">${parking.freeSpots > 0 ? (i18n[lang].status_available || "Available") : (i18n[lang].status_full || "Full")}</span></p>
    <p>${i18n[lang].label_location || "Location"}: Sibiu</p>
    <p>${i18n[lang].label_spots || "Spots"}: ${parking.freeSpots} / ${parking.totalSpots}</p>
    <p>${i18n[lang].label_price || "Price"}: ${parking.pricePerHour} RON/hour</p>
    <p>${i18n[lang].label_hours || "Hours"}: ${parking.openHours}</p>
    <button id="bookSelectedParkingBtn" style="width:100%; background:#007bff; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;" data-i18n="book_now_btn">${i18n[lang].book_now_btn || "Book Now"}</button>
  `;

  parkingListView.style.display = "none";
  parkingDetailsView.style.display = "block";

  document.getElementById("bookSelectedParkingBtn")?.addEventListener("click", () => {
    reservationPanel.style.display = "block";
    document.getElementById("panelTitle").innerText = "Book a spot";
    document.getElementById("selectedParkingName").innerText = "Parking: " + parking.name;
    setCurrentTimeDefault();
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
      const parking = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
          <b style="font-size:16px;">${parking.name}</b><br>
          Status: <span style="color:${parking.freeSpots > 0 ? "green" : "red"}; font-weight:bold;">${parking.freeSpots > 0 ? "Available" : "Full"}</span>
        </div>`;
      li.addEventListener("click", () => showParkingDetails(parking));
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

window.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'en';
    setLanguage(savedLang);
});

setCurrentTimeDefault();
loadParkings();