/* * This script helps users book a parking spot.
 * It shows a window when the button is clicked.
 */

import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

function setCurrentTimeDefault() {
  const timeInput = document.getElementById("startTime");
  if (!timeInput) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  timeInput.value = `${hh}:${mm}`;
}

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
            btn.addEventListener("click", (event) => {
                event.stopPropagation();
                document.getElementById("reservationModal").style.display = "block";
                document.getElementById("selectedParkingName").innerText = "Parking: " + parking.name;
                setCurrentTimeDefault();
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

/*  Functions to Edit or Cancel the reservation */

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
document.getElementById("editBtn").addEventListener("click", () => {
  document.getElementById("reservationModal").style.display = "block";
  document.getElementById("modalTitle").innerText = "Edit your time";
  setCurrentTimeDefault();
});

//  Update the Confirm button logic 

document.getElementById("confirmBooking").addEventListener("click", function() {
    var timeChosen = document.getElementById("startTime").value;
    
    if (timeChosen !== "") {
        // Show the manage box and update the text
        manageBox.style.display = "block";
        resInfo.innerText = "You have a spot reserved at " + timeChosen;

        alert("Success! Reservation updated to " + timeChosen);
        document.getElementById("reservationModal").style.display = "none";
    }
});

// Start everything
setCurrentTimeDefault();
loadParkings();