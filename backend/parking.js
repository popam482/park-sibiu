/* * This script gets parking data from firebase.
 * It shows the parkings in a list and moves the map when we click.
 */

import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

async function loadParkings() {
    var listElement = document.getElementById("parkingList");
    
    try {
        // We get the collection called "parkings"
        var dataFromFirebase = await getDocs(collection(db, "parkings"));
        
        // We clear the list before adding new items
        listElement.innerHTML = "";

        // We check every parking from the database
        dataFromFirebase.forEach(function(doc) {
            var parking = doc.data();
            var li = document.createElement("li");
            
            // We check if there are free spots to set the color
            var color = "red";
            var text = "Full";
            
            if (parking.freeSpots > 0) {
                color = "green";
                text = "Available";
            }

            // We create the HTML for the list item
            li.innerHTML = `
                <div style="padding: 10px;">
                    <b style="font-size: 18px;">${parking.name}</b><br>
                    Status: <span style="color: ${color}; font-weight: bold;">${text}</span>
                    
                    <div class="details-box" id="details-${doc.id}" style="display: none;">
                        <p>📍 Location: Sibiu</p>
                        <p>🚗 Spots: ${parking.freeSpots} / ${parking.totalSpots}</p>
                        <p>💰 Price: ${parking.pricePerHour} RON/hour</p>
                        <p>⏰ Hours: ${parking.openHours}</p>
                        <p style="color: grey;">(Click again to close)</p>
                    </div>
                </div>
            `;

            // When we click on a parking, we show the details and move the map
            li.addEventListener("click", function() {
                var box = document.getElementById("details-" + doc.id);
                
                if (box.style.display === "none") {
                    box.style.display = "block";
                    
                    // We move the map to the parking location
                    if (window.map) {
                        window.map.flyTo([parking.lat, parking.lng], 16);
                    }
                } else {
                    box.style.display = "none";
                }
            });

            listElement.appendChild(li);
        });
        
        console.log("Everything loaded correctly!");

    } catch (error) {
        console.log("There is an error:", error);
        listElement.innerHTML = "<li>Error loading data...</li>";
    }
}

// We run the function
loadParkings();