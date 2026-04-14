import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
var parkingTable = collection(db, "parkings");

// add a new parking 

// we look for the save button in the HTML page
var saveButton = document.getElementById("saveBtn");

// when we click the save button, this happens:
saveButton.onclick = async function() {
    // we get the text written by the user in the input boxes
    var enteredName = document.getElementById("pName").value;
    var enteredSpots = document.getElementById("pTotal").value;
    var enteredPrice = document.getElementById("pPrice").value;

    // check if any field is empty
    if (enteredName == "" || enteredSpots == "" || enteredPrice == "") {
        alert("Please fill in all the data!");
    } else {
        // if everything is okay, we send the data to Firebase
        await addDoc(parkingTable, {
            name: enteredName,
            totalSpots: Number(enteredSpots),
            freeSpots: Number(enteredSpots),
            pricePerHour: Number(enteredPrice),
            lat: 45.7983, // default location (Sibiu)
            lng: 24.1256
        });

        alert("Parking added successfully!");
        location.reload(); // refresh the page to see it in the list
    }
};

// showing the list and deleting parkings

// create a function to show the list of parkings when we open the page
async function showParkings() {
    // we get all the data from firebase
    var allData = await getDocs(parkingTable);
    var listArea = document.getElementById("adminList");
    
    listArea.innerHTML = ""; // clear the "Loading..." message

    // we go through each parking one by one
    allData.forEach(function(docFromFirebase) {
        var parkingData = docFromFirebase.data();
        var parkingId = docFromFirebase.id;

        // create a new div element (a row)
        var newElement = document.createElement("div");
        newElement.style.border = "1px solid black";
        newElement.style.margin = "5px";
        newElement.style.padding = "10px";
        newElement.style.display = "flex";
        newElement.style.justifyContent = "space-between";

        // add text to the element
        var textNode = document.createElement("span");
        textNode.innerText = "Name: " + parkingData.name + " | Price: " + parkingData.pricePerHour + " RON/h";
        newElement.appendChild(textNode);
        
        // create the delete button
        var deleteBtn = document.createElement("button");
        deleteBtn.innerText = "Delete";
        deleteBtn.style.color = "white";
        deleteBtn.style.backgroundColor = "red";
        deleteBtn.style.border = "none";
        deleteBtn.style.cursor = "pointer";

        // when we click "Delete"
        deleteBtn.onclick = async function() {
            var confirmation = confirm("Are you sure you want to delete " + parkingData.name + "?");
            if (confirmation == true) {
                // delete from the database using the unique ID
                await deleteDoc(doc(db, "parkings", parkingId));
                alert("Parking deleted!");
                location.reload(); // refresh the page
            }
        };

        // put the button inside the element, and the element inside the list
        newElement.appendChild(deleteBtn);
        listArea.appendChild(newElement);
    });
}
showParkings();

// user management and booking history

var usersTable = collection(db, "users");
var bookingsTable = collection(db, "bookings");

// function to show users and their history
async function showUsersAndHistory() {
    // get all users from firebase
    var allUsers = await getDocs(usersTable);
    var userArea = document.getElementById("userList");
    
    // clear the "Loading..." text
    userArea.innerHTML = "";

    // loop through each user
    allUsers.forEach(async function(userDoc) {
        var userData = userDoc.data();
        var userId = userDoc.id;

        // create a simple box for this user
        var userBox = document.createElement("div");
        userBox.className = "user-box"; 
        userBox.style.border = "1px solid #007bff";
        userBox.style.padding = "10px";
        userBox.style.marginTop = "15px";
        userBox.style.borderRadius = "5px";

        userBox.innerHTML = "<strong>User Email:</strong> " + userData.email;

        // search for this user's bookings 
        // we look in "bookings" for documents where "userId" matches
        var bookingQuery = query(bookingsTable, where("userId", "==", userId));
        var userBookings = await getDocs(bookingQuery);
        
        var historyHtml = "<br><span style='color: #555;'>History:</span>";

        if (userBookings.empty) {
            historyHtml += " No bookings found.";
        } else {
            // loop through each booking found
            userBookings.forEach(function(bookingDoc) {
                var b = bookingDoc.data();
                historyHtml += "<br> • " + b.parkingName + " | Total: " + b.totalCost + " RON";
            });
        }

        // add history to the box and the box to the page
        userBox.innerHTML += historyHtml;
        userArea.appendChild(userBox);
    });
}
showUsersAndHistory();