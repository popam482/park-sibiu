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

function renderMarkers(parkings) {
  markersLayer.clearLayers();

  parkings.forEach((p) => {
    if (p.lat == null || p.lng == null) return;

    const marker = L.marker([p.lat, p.lng]).addTo(markersLayer);
    marker.on("click", () => {
      if (typeof window.showParkingDetailsFromMap === "function") {
        window.showParkingDetailsFromMap(p);
      }
    });
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