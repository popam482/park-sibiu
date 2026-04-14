import { db, auth } from './firebase-config.js'; 
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

let allParkings = []; // Added this to store data for filtering

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
        
        //clear previous data
        allParkings = []; 
        const listArea = document.getElementById("parkingList");
        if (listArea) listArea.innerHTML = ""; 

        querySnapshot.forEach((doc) => {
            const p = doc.data();
            
            // saving data for filtering
            allParkings.push({ id: doc.id, ...p });

            // display on map
            L.marker([p.lat, p.lng])
                .addTo(map)
                .bindPopup(`
                    <b>${p.name}</b><br>
                    Spaces: ${p.freeSpots}/${p.totalSpots}<br>
                    Rate: ${p.pricePerHour} RON/hour<br>
                    Hours: ${p.openHours}
                `);

            // initially display all parkings in the list
            if (listArea) {
                const li = document.createElement("li");
                li.innerHTML = `<strong>${p.name}</strong> - ${p.pricePerHour} RON/h (${p.freeSpots} spots)`;
                listArea.appendChild(li);
            }
        });
    } catch (error) {
        console.error("Firebase read error:", error);
    }
}
displayParkingsFromFirebase();


//filter + sorting functions
function filterParkings() {
    const searchText = document.getElementById("searchInput").value.toLowerCase();
    const maxPrice = document.getElementById("priceFilter").value;
    const onlyFree = document.getElementById("availableOnly").checked;
    
    const sortType = document.getElementById("sortOptions").value;

    let results = allParkings.filter(parking => {
        const matchesName = parking.name.toLowerCase().includes(searchText);
        const matchesPrice = maxPrice === "all" || parking.pricePerHour <= parseInt(maxPrice);
        const matchesAvailable = !onlyFree || parking.freeSpots > 0;
        return matchesName && matchesPrice && matchesAvailable;
    });


    if (sortType === "priceAsc") {
        results.sort((a, b) => a.pricePerHour - b.pricePerHour);
    } else if (sortType === "priceDesc") {
        results.sort((a, b) => b.pricePerHour - a.pricePerHour);
    } else if (sortType === "spots") {
        results.sort((a, b) => b.freeSpots - a.freeSpots);
    }

    renderFilteredList(results);
}

// function to update only the List UI
function renderFilteredList(dataList) {
    const listArea = document.getElementById("parkingList");
    if (!listArea) return;
    
    listArea.innerHTML = ""; 

    dataList.forEach(p => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${p.name}</strong> - ${p.pricePerHour} RON/h (${p.freeSpots} spots)`;
        listArea.appendChild(li);
    });
}

document.getElementById("searchInput").addEventListener("keyup", filterParkings);
document.getElementById("priceFilter").addEventListener("change", filterParkings);
document.getElementById("availableOnly").addEventListener("change", filterParkings);
document.getElementById("sortOptions").addEventListener("change", filterParkings);