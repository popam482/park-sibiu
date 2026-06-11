## Park Sibiu — README Text from Business Analyst

### Overview
Park Sibiu is a prototype parking management website for users in Sibiu. It lets registered users search and book parking spaces on an interactive map, manage their license plates and profile, review parking history, and generate monthly invoice summaries.

### Live page
View the live page at: https://popam482.github.io/park-sibiu/frontend/

### How it should work

1. User Authentication
   - Users must log in or sign up on `frontend/login.html`.
   - Login options: email/password, sign up, Google login.
   - Authentication is handled with Firebase Auth.
   - After login, the user is redirected to `frontend/index.html`.

2. Main Parking Map
   - `frontend/index.html` shows a Leaflet map centered on Sibiu.
   - Parking locations are displayed as map markers from the Firebase `parkings` collection.
   - Each marker shows:
     - parking name
     - available spots
     - hourly price
     - status: available or occupied
   - If the user has an active reservation, the marker highlights the reserved spot and displays a countdown timer.

3. Parking List and Filters
   - A panel opens from the main page showing all available parkings.
   - Users can:
     - search by parking name
     - filter to “Available Only”
     - filter to “Open 24/7”
     - sort the list by price ascending or descending
   - Selecting a parking from the list opens detailed information and booking options.

4. Booking a Parking Spot
   - Users can book a parking spot from the parking detail view.
   - Booking inputs include:
     - plate number (typed or chosen from saved plates)
     - start time
     - number of hours
     - option to book until the end of the day
   - The reservation creates a Firebase `reservations` record and reduces `freeSpots` in the selected parking.
   - A live reservation state is stored in browser `localStorage` for session persistence.

5. Reservation Management
   - Active bookings are shown on the map and in the “My Reservation” panel.
   - Users can:
     - pay for the reservation
     - edit the time
     - cancel the booking
   - Expired reservations are automatically released and the spot becomes available again.

6. Parking & Billing History
   - `frontend/parking-history.html` displays past parking sessions from Firebase.
   - The page shows:
     - date
     - location
     - duration
     - plate
     - cost
     - status
   - A monthly billing summary totals paid/completed parking costs.
   - Users can generate a PDF invoice of their parking history.

7. Profile and Preferences
   - `frontend/profile.html` allows users to manage:
     - display name
     - saved license plates
     - favorite license plate
     - language preference
     - dark mode preference
     - password reset
   - Profile data is persisted in the Firebase `users` collection.
   - Saved plates are used to speed up booking and ensure correct plate formatting.

### Architecture and Implementation
- Frontend:
  - HTML pages in `frontend/`
  - CSS files: `login-styles.css`, `map-styles.css`, `profile-styles.css`
  - Uses Leaflet for map rendering
  - Uses `localStorage` for temporary booking state and favorite plate
- Backend logic:
  - JavaScript modules in `backend/`
  - `backend/firebase-config.js` connects to Firebase
  - `backend/login.js` handles authentication
  - `backend/parking.js` handles booking, cancellation, reservation timers, and availability logic
  - `backend/script.js` renders live map markers and listens for real-time Firestore updates
  - `backend/parking-history.js` loads historical reservations and generates PDF invoices
  - `backend/profile.js` manages profile settings and saved plates
- Data model:
  - `users` collection: profile data, license plates, preferences
  - `parkings` collection: parking sites, capacity, price, real-time availability
  - `reservations` collection: user bookings, start/end time, cost, payment/reservation status

### Business logic summary
- Parking availability is real-time and visible on the map.
- Users can reserve a specific parking location and get a countdown until their booking ends.
- The system supports active booking cancellation and automatic release when time expires.
- Billing is tracked monthly with a simple invoice export option.
- User profile data supports vehicle and preference management to simplify repeat bookings.

### Notes
- This project is currently implemented as a client-side app backed by Firebase services, not a separate server application.
- The user experience is built around a map-first booking flow plus supporting profile/history pages.
