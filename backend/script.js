import { db } from './firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const map = L.map('map').setView([45.7983, 24.1256], 13);
window.map = map;

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
window.latestParkings = []; 

// function renderMarkers(parkings) {
//   markersLayer.clearLayers();

//   parkings.forEach((p) => {
//     if (p.lat == null || p.lng == null) return;

//     const marker = L.marker([p.lat, p.lng]).addTo(markersLayer);
//     marker.on("click", () => {
//       if (typeof window.showParkingDetailsFromMap === "function") {
//         window.showParkingDetailsFromMap(p);
//       }
//     });
//   });
// }

function renderMarkers(parkings) {
  markersLayer.clearLayers();

  parkings.forEach((p) => {
    if (p.lat == null || p.lng == null) return;

    const marker = L.marker([p.lat, p.lng]).addTo(markersLayer);

    const isMyBooking = window.activeReservationParkingId === String(p.id);

    let statusColor = p.freeSpots > 0 ? '#27ae60' : '#e74c3c';
    let label = p.freeSpots > 0 ? 'Available' : 'Full';

    marker.bindTooltip(`
      <div style="text-align: center;">
        <strong style="color: #2c3e50;">${p.name}</strong><br>
        <b style="color: ${isMyBooking ? '#3498db' : statusColor};">
          ${isMyBooking ? '⭐ YOUR SPOT' : label}
        </b><br>
        <span>${p.freeSpots}/${p.totalSpots} spots</span>
      </div>
    `, { direction: 'top', offset: [0, -10] });

    marker.on("click", () => {
      if (isMyBooking) {
        map.flyTo([p.lat, p.lng], 16);
        alert("This is your active reservation!");
      } else if (typeof window.showParkingDetailsFromMap === "function") {
        window.showParkingDetailsFromMap(p);
      }
    });

    if (isMyBooking) {
      marker.getElement()?.style.setProperty('filter', 'hue-rotate(150deg) saturate(3)');
    }
  });
}
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