import { db, auth } from './firebase-config.js'; 
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { setLanguage } from './translations.js';

// initialize Map
const map = L.map('map').setView([45.7983, 24.1256], 13);
window.map = map;

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

    const marker = L.marker([p.lat, p.lng]).addTo(map);

    marker.on("click", () => {
    marker.closePopup();

    if (typeof window.showParkingDetailsFromMap === "function") {
      window.showParkingDetailsFromMap(p);
    }
    });
});
    } catch (error) {
        console.error("Firebase read error:", error);
    }
}
window.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'en';
    setLanguage(savedLang);
});
//displaying parkings on map
displayParkingsFromFirebase();