/* * This script helps users book a parking spot.
 * It shows a window when the button is clicked.
 */

import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// --- 1. ADAUGĂ ASTA AICI (Variabila globală pentru preț) ---
var currentPricePerHour = 0; 

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
                
                // --- 2. ADAUGĂ ASTA AICI (Salvăm prețul parcării selectate) ---
                currentPricePerHour = parking.pricePerHour;

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

/* * Functions to Edit or Cancel the reservation */

var manageBox = document.getElementById("manageReservation");
var resInfo = document.getElementById("resInfo");

// Function to Cancel
document.getElementById("cancelBtn").addEventListener("click", function() {
    var sure = confirm("Are you sure you want to cancel your booking?");
    if (sure) {
        manageBox.style.display = "none";
        alert("Reservation cancelled successfully.");
    }
});

//  Function to Edit
document.getElementById("editBtn").addEventListener("click", function() {
    document.getElementById("reservationModal").style.display = "block";
    document.getElementById("modalTitle").innerText = "Edit your time";
});

// This button confirms the booking and calculates the cost
document.getElementById("confirmBooking").addEventListener("click", function() {
    var timeChosen = document.getElementById("startTime").value;
    var hoursAmount = document.getElementById("duration").value;
    
    if (timeChosen !== "") {
        // Price * Hours
        var totalCost = hoursAmount * currentPricePerHour;

        manageBox.style.display = "block";
        resInfo.innerText = "Reserved at " + timeChosen + " for " + hoursAmount + " hours.";
        
        // Show the price and set status to unpaid
        document.getElementById("costText").innerText = "Total to pay: " + totalCost + " RON";
        document.getElementById("statusText").innerText = "Status: NOT PAID";
        document.getElementById("statusText").style.color = "blue";
        document.getElementById("payBtn").style.display = "inline-block";

        alert("Reservation saved! Total cost: " + totalCost + " RON");
        document.getElementById("reservationModal").style.display = "none";
    }
});

// This button simulates the payment
document.getElementById("payBtn").addEventListener("click", function() {
    alert("Connecting to bank...");
    alert("Payment successful! Thank you.");
    
    document.getElementById("statusText").innerText = "Status: PAID ✅";
    document.getElementById("statusText").style.color = "green";
    document.getElementById("payBtn").style.display = "none";
});

// Start everything
loadParkings();