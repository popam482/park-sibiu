import { db, auth } from './firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

import { applyFiltersAndRender, refreshSelectedParkingFromLive } from './parking.js';

import { i18n } from './translations.js';
const currentLang = localStorage.getItem('preferredLang') || (navigator.language.startsWith('ro') ? 'ro' : 'en');

const map = L.map('map').setView([45.7983, 24.1256], 13);
window.map = map;

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
window.latestParkings = [];

function getParkingIcon(color) {
  const colors = {
    'green': '#27ae60',
    'orange': '#f39c12',
    'gold': '#f1c40f',
    'red': '#e74c3c',
    'violet': '#9b59b6',
    'blue': '#3498db'
  };

  const htmlIcon = `
    <div style="
      width: 30px;
      height: 40px;
      background: ${colors[color] || colors['blue']};
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        transform: rotate(45deg);
        color: white;
        font-size: 16px;
        font-weight: bold;
      ">🅿</div>
    </div>
  `;

  return L.divIcon({
    html: htmlIcon,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
    className: 'parking-marker'
  });
}


function renderMarkers(parkings) {
  if (!markersLayer || !parkings || parkings.length === 0) return;
  
  markersLayer.clearLayers();
  const lang = i18n[currentLang];
  const myBookingsList = JSON.parse(localStorage.getItem('myBookingsList') || "[]");

  parkings.forEach((p) => {
    if (p.lat == null || p.lng == null || !p.id) return;

    const myReservation = myBookingsList.find(b => b.parkingId && String(b.parkingId) === String(p.id));
    const isMySpot = !!myReservation;

    let markerColor = 'blue';

    if (isMySpot) {
      markerColor = 'violet';
    } else {
      const free = Number(p.freeSpots) || 0;
      const total = Number(p.totalSpots) || 1;
      const ratio = free / total;

      if (ratio > 0.6) {
        markerColor = 'green';
      } else if (ratio >= 0.3) {
        markerColor = 'orange';
      } else if (ratio > 0) {
        markerColor = 'gold';
      } else {
        markerColor = 'red';
      }
    }

    const markerIcon = getParkingIcon(markerColor);
    const marker = L.marker([p.lat, p.lng], { icon: markerIcon }).addTo(markersLayer);

    if (isMySpot && marker._icon) {
      marker._icon.style.zIndex = "1000";
    }

    let popupContent = `<div style="text-align: center; min-width: 160px; font-family: sans-serif;">`;
    popupContent += `<strong style="font-size:14px;">${p.name}</strong><br><hr style="margin:5px 0; border:0; border-top:1px solid #eee;">`;

    if (isMySpot) {
      const specificEndTime = myReservation.endTime;
      popupContent += `
        <div style="background: #eef2ff; padding: 12px; border-radius: 8px; border: 1px solid #e0e7ff; text-align: center;">
          <div style="font-size: 11px; color: #4f46e5; font-weight: bold; margin-bottom: 5px;">${lang.map_my_reservation || "MY RESERVATION"}</div>
          <b class="map-countdown" data-endtime="${specificEndTime}" style="font-size: 20px; color: #1e40af; font-family: monospace;">--:--:--</b>
        </div>
        <button onclick="window.handleCancelFromMap('${myReservation.id}', '${p.id}')" 
                style="margin-top:10px; width:100%; padding:8px; border:none; border-radius:5px; background:#ef4444; color:white; cursor:pointer; font-weight: bold;">
          ${lang.map_btn_cancel || "Cancel Reservation"}
        </button>`;
      
      marker.on('popupopen', () => { 
        setTimeout(startMapCountdown, 100); 
      });
    } else {
      const isFull = p.freeSpots <= 0;
      popupContent += `
        <div style="padding: 8px; text-align: left;">
          <div>${lang.map_spots || "Spots"}: <b>${p.freeSpots}/${p.totalSpots}</b></div>
          <div>${lang.map_price || "Price"}: <b>${p.pricePerHour} RON/h</b></div>
          <div style="margin-top: 8px;">
            <span style="color:${isFull ? 'red' : 'green'}; font-weight:bold;">
              ${isFull ? (lang.map_occupied || "Occupied") : (lang.map_available || "Available")}
            </span>
          </div>
        </div>`;
    }

    popupContent += `</div>`;
    marker.bindPopup(popupContent);
    marker.on('mouseover', function() { this.openPopup(); });

    marker.on('click', () => {
      if (!isMySpot && typeof window.showParkingDetailsFromMap === "function") {
        window.showParkingDetailsFromMap(p);
      }
    });
  });
}

function startMapCountdown() {
  if (window.mapTimerInterval) clearInterval(window.mapTimerInterval);
  const lang = i18n[currentLang];
  
  const updateTicker = () => {
    const displays = document.querySelectorAll('.map-countdown');
    
    if (displays.length === 0) {
      clearInterval(window.mapTimerInterval);
      window.mapTimerInterval = null;
      return;
    }

    displays.forEach(display => {
      const endTimeStr = display.getAttribute('data-endtime');
      if (!endTimeStr) return;
      
      const endTime = new Date(endTimeStr).getTime();
      const now = new Date().getTime();
      const distance = endTime - now;

      if (distance < 0) {
        display.innerHTML = lang.map_expired || "EXPIRED";
        display.style.color = "#7f8c8d";
      } else {
        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        display.innerHTML = 
          (hours < 10 ? "0" + hours : hours) + ":" + 
          (minutes < 10 ? "0" + minutes : minutes) + ":" + 
          (seconds < 10 ? "0" + seconds : seconds);
      }
    });
  };

  updateTicker();
  window.mapTimerInterval = setInterval(updateTicker, 1000);
}

// Handler pentru anularea din hartă
window.handleCancelFromMap = function(reservationId, parkingId) {
  if (typeof window.cancelAnyReservation === "function") {
    window.cancelAnyReservation(reservationId, parkingId);
  } else {
    console.error("Funcția de cancel nu este disponibilă.");
  }
};


window.renderMarkers = renderMarkers;
window.applyFiltersAndRender = applyFiltersAndRender;

onSnapshot(collection(db, "parkings"), (snapshot) => {
  window.latestParkings = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));


  if (!auth.currentUser) {
    localStorage.removeItem('myBookingsList');
    localStorage.removeItem('activeReservationId');
  }

  renderMarkers(window.latestParkings);
  

  if (typeof window.applyFiltersAndRender === "function") {
    window.applyFiltersAndRender();
  }

  if (typeof window.refreshSelectedParkingFromLive === "function") {
    window.refreshSelectedParkingFromLive(window.latestParkings);
  }
}, (err) => {
  const lang = i18n[currentLang];
  console.error("Error loading parkings:", err);
  alert(lang.map_load_error || "Error loading map data.");
});
