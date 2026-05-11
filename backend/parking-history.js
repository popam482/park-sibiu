import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate();
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export async function getHistory(userId) {
    const historyTableBody = document.getElementById("historyTableBody");
    const totalDisplay = document.getElementById("totalToPay");
    
    try {
        const q = query(
            collection(db, "reservations"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        let totalAccumulated = 0;
        let html = "";

        if (querySnapshot.empty) {
            historyTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No parking sessions found.</td></tr>`;
            return [];
        }

        const sessions = [];

       querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    sessions.push({ ...data, id });

    if (data.status === "paid" || data.status === "completed") {
        totalAccumulated += data.totalCost || 0;
    }

    const now = new Date();
    const endTime = data.endTime?.toDate() || new Date(0);
    const isStillActive = now < endTime && data.status !== "cancelled" && data.status !== "completed";
    
    const statusClass = (data.status === "paid" || data.status === "completed") ? "status-paid" : "status-pending";

    html += `
        <tr>
            <td>${formatDate(data.startTime)}</td>
            <td>${data.parkingName || "Unknown"}</td>
            <td>${data.durationHours} h</td>
            <td>${data.plateNumber}</td>
            <td>${(data.totalCost || 0).toFixed(2)} RON</td>
            <td>
                <span class="${statusClass}">${data.status.toUpperCase()}</span>
                ${isStillActive ? 
                    `<button class="btn-cancel-small" onclick="cancelActiveReservation('${id}', '${data.parkingId}')">Cancel & Release</button>` 
                    : ''}
            </td>
        </tr>
    `;
});

        historyTableBody.innerHTML = html;
        totalDisplay.innerText = `${totalAccumulated.toFixed(2)} RON`;
        
        return sessions;

    } catch (error) {
        console.error("Error fetching history:", error);
        historyTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error loading history.</td></tr>`;
    }
}

export function generatePDF(sessions, total) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Monthly Parking Invoice - Park Sibiu", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Total Amount: ${total.toFixed(2)} RON`, 20, 40);
    
    doc.line(20, 45, 190, 45); 

    let y = 55;
    doc.text("Details:", 20, y);
    y += 10;

    sessions.forEach((s) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const text = `${formatDate(s.startTime)} - ${s.parkingName}: ${s.totalCost.toFixed(2)} RON`;
        doc.text(text, 25, y);
        y += 7;
    });

    doc.save(`Invoice_ParkSibiu_${new Date().getMonth() + 1}.pdf`);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const sessions = await getHistory(user.uid);
        
        document.getElementById("generateInvoiceBtn").onclick = () => {
            const total = parseFloat(document.getElementById("totalToPay").innerText);
            generatePDF(sessions, total);
        };
    } else {
        window.location.href = "login.html"; 
    }
});

window.cancelActiveReservation = async (reservationId, parkingId) => {
    if (!confirm("Your parking session is still active. Do you want to cancel it and release the spot now?")) return;

    try {
        const reservationRef = doc(db, "reservations", reservationId);
        const parkingRef     = doc(db, "parkings", String(parkingId));

        await runTransaction(db, async (tx) => {
            const parkSnap = await tx.get(parkingRef);
            

            tx.update(reservationRef, { 
                status: "cancelled",
                cancelledAt: new Date() 
            });


            if (parkSnap.exists()) {
                const currentFree = Number(parkSnap.data().freeSpots || 0);
                const totalSpots = Number(parkSnap.data().totalSpots || 0);
                
                if (currentFree < totalSpots) {
                    tx.update(parkingRef, { freeSpots: currentFree + 1 });
                }
            }
        });

        alert("Reservation cancelled and spot is now free!");
        location.reload(); 
    } catch (err) {
        console.error("Error during cancellation:", err);
        alert("Failed to cancel: " + err.message);
    }
};