/* * This script helps users book a parking spot.
 * It shows a window when the button is clicked.
 */

import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

async function loadParkings() {
    var listElement = document.getElementById("parkingList");
    
    try {
        var dataFromFirebase = await getDocs(collection(db, "parkings"));
        listElement.innerHTML = "";

        dataFromFirebase.forEach(function(doc) {
            var parking = doc.data();
            var li = document.createElement("li");
            
            var color = "red";
            var text = "Full";
            if (parking.freeSpots > 0) {
                color = "green";
                text = "Available";
            }

            // We added a "Book Now" button here
            li.innerHTML = `
                <div style="padding: 10px;">
                    <b style="font-size: 18px;">${parking.name}</b><br>
                    Status: <span style="color: ${color}; font-weight: bold;">${text}</span>
                    
                    <div class="details-box" id="details-${doc.id}" style="display: none;">
                        <p>📍 Location: Sibiu</p>
                        <p>🚗 Spots: ${parking.freeSpots} / ${parking.totalSpots}</p>
                        <p>💰 Price: ${parking.pricePerHour} RON/hour</p>
                        <p>⏰ Hours: ${parking.openHours}</p>
                        <button class="booking-button" style="width: 100%; background: #007bff; color: white; border: none; padding: 10px; border-radius: 5px; margin-top: 10px; cursor: pointer;">Book Now</button>
                    </div>
                </div>
            `;

            // Click to show details and move map
            li.addEventListener("click", function() {
                var box = document.getElementById("details-" + doc.id);
                if (box.style.display === "none") {
                    box.style.display = "block";
                    if (window.map) {
                        window.map.flyTo([parking.lat, parking.lng], 16);
                    }
                } else {
                    box.style.display = "none";
                }
            });

            // Logic for the Book Now button
            var btn = li.querySelector(".booking-button");
            btn.addEventListener("click", function(event) {
                event.stopPropagation(); // This stops the list from closing
                document.getElementById("reservationModal").style.display = "block";
                document.getElementById("selectedParkingName").innerText = "Parking: " + parking.name;
            });

            listElement.appendChild(li);
        });

    } catch (error) {
        console.log("Error logic:", error);
    }
}

// Logic for the buttons inside the pop-up window
document.getElementById("closeModal").addEventListener("click", function() {
    document.getElementById("reservationModal").style.display = "none";
});

document.getElementById("confirmBooking").addEventListener("click", function() {
    var timeChosen = document.getElementById("startTime").value;
    
    if (timeChosen === "") {
        alert("Please select a time first!");
    } else {
        alert("Success! Your spot is reserved for " + timeChosen);
        document.getElementById("reservationModal").style.display = "none";
    }
});

// Start everything
loadParkings();