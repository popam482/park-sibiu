import { db } from './firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
window.renderMarkers = renderMarkers; 

const map = L.map('map').setView([45.7983, 24.1256], 13);
window.map = map;

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
window.latestParkings = []; 

function renderMarkers(parkings) {
  markersLayer.clearLayers();

  const myBookingId = window.activeReservationParkingId || localStorage.getItem('myBooking');
  const myStatus = localStorage.getItem('myBookingStatus') || 'pending';

  parkings.forEach((p) => {
    if (p.lat == null || p.lng == null) return;

    const marker = L.marker([p.lat, p.lng]).addTo(markersLayer);
    const isMySpot = myBookingId === String(p.id);

    let popupContent = `<div style="text-align: center; min-width: 160px; font-family: sans-serif;">`;
    popupContent += `<strong style="font-size:14px;">${p.name}</strong><br><hr style="margin:5px 0; border:0; border-top:1px solid #eee;">`;

    if (isMySpot) {
      const statusColor = myStatus === 'paid' ? '#27ae60' : '#2980b9';
      const statusLabel = myStatus === 'paid' ? 'PAID' : 'NOT PAID';

      popupContent += `
        <div style="background: #fdf2f2; padding: 5px; border-radius: 5px; border: 1px solid #f9ebeb;">
            <b style="color: ${statusColor}; font-size: 12px;">⭐ Your Spot (${statusLabel})</b><br>
            <small>Sibiu, Romania</small>
        </div>
        <button onclick="window.handleCancelFromMap()" 
          style="margin-top:10px; width:100%; background:#e74c3c; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;">
          Cancel Reservation
        </button>
      `;
      
      if (marker._icon) marker._icon.classList.add('yellow-marker');
      marker.bindTooltip("My Parking Spot", { permanent: true, direction: 'top', className: 'my-spot-label' });
      
    } else {
      const isFull = p.freeSpots <= 0;
      popupContent += `
        Locuri: ${p.freeSpots}/${p.totalSpots}<br>
        Preț: <b>${p.pricePerHour} RON/h</b><br>
        <span style="color:${isFull ? 'red' : 'green'}; font-weight:bold;">
            ${isFull ? 'Ocupat' : 'Disponibil'}
        </span>
      `;
    }

    popupContent += `</div>`;
    marker.bindPopup(popupContent);

    marker.on('mouseover', function() { this.openPopup(); });

    marker.on('click', () => {
      if (typeof window.showParkingDetailsFromMap === "function") {
        window.showParkingDetailsFromMap(p);
      }
    });
  });
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
  const parkings = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
  window.latestParkings = parkings;
  renderMarkers(parkings);
  if (typeof window.renderParkingListFromLive === "function") {
    window.renderParkingListFromLive(parkings);
  }
  if (typeof window.refreshSelectedParkingFromLive === "function") {
    window.refreshSelectedParkingFromLive(parkings);
  }
}, (err) => {
  console.error("Realtime listener error:", err);
});
