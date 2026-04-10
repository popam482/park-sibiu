import { db, auth } from './firebase-config.js'; 
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// initialize Map
const map = L.map('map').setView([45.7983, 24.1256], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// display parkings from Firebase
async function displayParkingsFromFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "parkings"));
        
        querySnapshot.forEach((doc) => {
            const p = doc.data();
            L.marker([p.lat, p.lng])
                .addTo(map)
                .bindPopup(`
                    <b>${p.name}</b><br>
                    Spaces: ${p.freeSpots}/${p.totalSpots}<br>
                    Rate: ${p.pricePerHour} RON/hour<br>
                    Hours: ${p.openHours}
                `);
        });
    } catch (error) {
        console.error("Firebase read error:", error);
    }
}

//displaying parkings on map
displayParkingsFromFirebase();