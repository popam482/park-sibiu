// This script helps with the profile page and firebase

import { db, auth } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { onAuthStateChanged, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

// I get all the buttons and inputs from the html
var nameInput = document.getElementById("displayName");
var langSelect = document.getElementById("languageSelect");
var darkToggle = document.getElementById("darkModeToggle");

// This function checks if we are logged in
onAuthStateChanged(auth, (user) => {
    if (user != null) {
        // We look for the user in the database
        var userRef = doc(db, "users", user.uid);
        
        getDoc(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                var data = snapshot.data();
                
                // Put the data in the inputs
                nameInput.value = data.displayName;
                
                if (data.preferences != null) {
                    langSelect.value = data.preferences.language;
                    darkToggle.checked = data.preferences.theme == "dark";
                    
                    // Change color if dark mode is on
                    if (darkToggle.checked == true) {
                        document.body.style.backgroundColor = "#333";
                        document.body.style.color = "white";
                    }
                }
            }
        });
    } else {
        // If not logged in, go back
        window.location.href = "login.html";
    }
});

// Function to save what the user likes
function saveStuff() {
    var user = auth.currentUser;
    if (user != null) {
        var userRef = doc(db, "users", user.uid);
        
        // I save them one by one to be sure
        updateDoc(userRef, {
            "preferences.language": langSelect.value,
            "preferences.theme": darkToggle.checked ? "dark" : "light"
        });

        // Simple way to change the background color
        if (darkToggle.checked == true) {
            document.body.style.backgroundColor = "#333";
            document.body.style.color = "white";
        } else {
            document.body.style.backgroundColor = "white";
            document.body.style.color = "black";
        }
    }
}

// Listen for clicks or changes
langSelect.addEventListener("change", function() {
    saveStuff();
});

darkToggle.addEventListener("change", function() {
    saveStuff();
});

// The button for the name
var saveNameBtn = document.getElementById("saveNameBtn");
saveNameBtn.addEventListener("click", function() {
    var user = auth.currentUser;
    if (user != null) {
        var userRef = doc(db, "users", user.uid);
        updateDoc(userRef, { 
            displayName: nameInput.value 
        });
        alert("Done! Name changed.");
    }
});

// The button for password
var resetBtn = document.getElementById("resetPasswordBtn");
resetBtn.addEventListener("click", function() {
    var email = auth.currentUser.email;
    sendPasswordResetEmail(auth, email);
    alert("Check your email to change password");
});

// Logout button
var logoutBtn = document.getElementById("logoutBtn");
logoutBtn.addEventListener("click", function() {
    signOut(auth);
    window.location.href = "login.html";
});