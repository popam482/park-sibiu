import { db } from './firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
window.renderMarkers = renderMarkers; 

import { applyFiltersAndRender, refreshSelectedParkingFromLive } from './parking.js';

const map = L.map('map').setView([45.7983, 24.1256], 13);
window.map = map;

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
window.latestParkings = []; 

window.applyFiltersAndRender = applyFiltersAndRender; 

function renderMarkers(parkings) {
  markersLayer.clearLayers();

  const myBookingsList = JSON.parse(localStorage.getItem('myBookingsList') || "[]");

  parkings.forEach((p) => {
    if (p.lat == null || p.lng == null) return;

    const myReservation = myBookingsList.find(b => String(b.parkingId) === String(p.id));
    const isMySpot = !!myReservation;

    const marker = L.marker([p.lat, p.lng]).addTo(markersLayer);
    
    let popupContent = `<div style="text-align: center; min-width: 160px; font-family: sans-serif;">`;
    popupContent += `<strong style="font-size:14px;">${p.name}</strong><br><hr style="margin:5px 0; border:0; border-top:1px solid #eee;">`;

    if (isMySpot) {
      const specificEndTime = myReservation.endTime;

      popupContent += `
        <div style="background: #fdf2f2; padding: 12px; border-radius: 8px; border: 1px solid #f9ebeb; text-align: center;">
            <div style="font-size: 12px; color: #7f8c8d; font-weight: bold; margin-bottom: 5px;">TIME REMAINING</div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <span style="font-size: 11px; color: #95a5a6;">Remaining:</span>
                <b class="map-countdown" data-endtime="${specificEndTime}" style="font-size: 20px; color: #e74c3c; font-family: 'Courier New', monospace; letter-spacing: 1px;">--:--:--</b>
            </div>
        </div>
        <button onclick="window.handleCancelFromMap()" 
            style="margin-top:10px; width:100%; background:#e74c3c; color:white; border:none; padding:12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size: 14px; transition: 0.3s;">
            Cancel Reservation
        </button>
      `;

      marker.on('popupopen', () => {
          setTimeout(() => {
              startMapCountdown(); 
          }, 100);
      });

      marker.on('popupclose', () => {
          if (window.mapTimerInterval) {
              clearInterval(window.mapTimerInterval);
              window.mapTimerInterval = null;
          }
      });

      if (marker._icon) {
          marker._icon.style.filter = "hue-rotate(140deg) brightness(0.9) saturate(2)";
      }
    } else {
      const isFull = p.freeSpots <= 0;
      popupContent += `
        Spots: ${p.freeSpots}/${p.totalSpots}<br>
        Price: <b>${p.pricePerHour} RON/h</b><br>
        <span style="color:${isFull ? 'red' : 'green'}; font-weight:bold;">
            ${isFull ? 'Occupied' : 'Available'}
        </span>
      `;
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

    const updateTicker = () => {
        const displays = document.querySelectorAll('.map-countdown');
        
        if (displays.length === 0) {
            clearInterval(window.mapTimerInterval);
            return;
        }

        displays.forEach(display => {
            const endTimeStr = display.getAttribute('data-endtime');
            const endTime = new Date(endTimeStr).getTime();
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 0) {
                display.innerHTML = "EXPIRED";
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
window.handleCancelFromMap = function() {
    const cancelBtn = document.getElementById("cancelBtn");
    if (cancelBtn) {
        cancelBtn.click(); 
    } else {
        console.error("couldn't find button");
    }
};
onSnapshot(collection(db, "parkings"), (snapshot) => {
    window.latestParkings = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));

    renderMarkers(window.latestParkings);
    
    if (typeof window.applyFiltersAndRender === "function") {
        window.applyFiltersAndRender();
    }

    if (typeof window.refreshSelectedParkingFromLive === "function") {
        window.refreshSelectedParkingFromLive(window.latestParkings);
    }
}, (err) => {
  console.error("Realtime listener error:", err);
});