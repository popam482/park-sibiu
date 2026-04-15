/* * This script fetches parking data from Firebase.
 * It shows the parkings in a list below the map.
 */

import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

async function loadParkings() {
    var listElement = document.getElementById("parkingList");
    
    try {
        // 1. Get the data from Firestore
        var querySnapshot = await getDocs(collection(db, "parkings"));
        
        // 2. Clear the "Loading" message
        listElement.innerHTML = "";

        // 3. Check if we actually have data
        if (querySnapshot.empty) {
            listElement.innerHTML = "<li>No parkings found in database.</li>";
            return;
        }

        querySnapshot.forEach((doc) => {
            var p = doc.data(); // p for parking
            
            // 4. Create the list item
            var li = document.createElement("li");
            
            // Logic for status: if freeSpots > 0 then it's Green (Free)
            var statusText = "Occupied";
            var statusColor = "red";
            
            if (p.freeSpots > 0) {
                statusText = "Free";
                statusColor = "green";
            }

            // 5. Build the text for the list item (Beginner style)
            li.innerHTML = `
                <strong>${p.name}</strong><br>
                Status: <span style="color: ${statusColor}">${statusText}</span> (${p.freeSpots} / ${p.totalSpots} spots)<br>
                Price: ${p.pricePerHour} RON/hour | Hours: ${p.openHours}
            `;
            
            listElement.appendChild(li);
        });
        
        console.log("List updated successfully!");

    } catch (error) {
        console.error("My Error:", error);
        listElement.innerHTML = "<li>Error loading data. Check console.</li>";
    }
}

// Start the function
loadParkings();