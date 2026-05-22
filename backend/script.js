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

const getParkingIcon = (color) => {
    const iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-' + color + '.png';
    const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

    return new L.Icon({
        iconUrl: iconUrl,
        shadowUrl: shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
};

function renderMarkers(parkings) {
    if (!markersLayer) return;
    markersLayer.clearLayers();

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
                    <div style="font-size: 11px; color: #4f46e5; font-weight: bold; margin-bottom: 5px;">MY RESERVATION</div>
                    <b class="map-countdown" data-endtime="${specificEndTime}" style="font-size: 20px; color: #1e40af; font-family: monospace;">--:--:--</b>
                </div>
                <button onclick="window.handleCancelFromMap('${myReservation.id}', '${p.id}')" 
                        style="margin-top:10px; width:100%; padding:8px; border:none; border-radius:5px; background:#ef4444; color:white; cursor:pointer;">
                        Cancel Reservation
                </button>`;
            marker.on('popupopen', () => { setTimeout(startMapCountdown, 100); });
        } else {
            const isFull = p.freeSpots <= 0;
            popupContent += `
                Spots: ${p.freeSpots}/${p.totalSpots}<br>
                Price: <b>${p.pricePerHour} RON/h</b><br>
                <span style="color:${isFull ? 'red' : 'green'}; font-weight:bold;">
                    ${isFull ? 'Occupied' : 'Available'}
                </span>`;
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
    window.handleCancelFromMap = function(reservationId, parkingId) {
    if (typeof window.cancelAnyReservation === "function") {
        window.cancelAnyReservation(reservationId, parkingId);
    } else {
        console.error("Funcția de cancel nu este disponibilă.");
    }
};
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
  console.error("Realtime listener error:", err);
});