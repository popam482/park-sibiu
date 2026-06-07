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

function loadLogoDataUrl() {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(null);
        img.src = "../graphics/icon.png";
    });
}

export async function generatePDF(sessions, total) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const logoDataUrl = await loadLogoDataUrl();
    const user = auth.currentUser;
    const customerName = user?.displayName || user?.email || "Park Sibiu user";
    const invoiceDate = new Date();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const tableWidth = pageWidth - margin * 2;
    const brand = [47, 111, 70];
    const brandDark = [16, 24, 20];
    const accent = [185, 231, 105];
    const soft = [244, 248, 240];
    const border = [214, 224, 216];
    const muted = [82, 97, 90];

    function drawHeader() {
        doc.setFillColor(...brandDark);
        doc.rect(0, 0, pageWidth, 42, "F");

        doc.setFillColor(...brand);
        doc.rect(0, 36, pageWidth, 6, "F");

        if (logoDataUrl) {
            doc.addImage(logoDataUrl, "PNG", pageWidth - 34, 10, 16, 16);
        }

        doc.setTextColor(248, 250, 247);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Park Sibiu", pageWidth / 2, 17, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("Monthly Parking Invoice", pageWidth / 2, 27, { align: "center" });
    }

    function drawFooter(pageNumber) {
        doc.setDrawColor(...border);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
        doc.setTextColor(...muted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Park Sibiu - Smart city parking", margin, pageHeight - 11);
        doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 11, { align: "right" });
    }

    function drawInfoCard() {
        doc.setFillColor(...soft);
        doc.roundedRect(margin, 52, tableWidth, 34, 3, 3, "F");

        doc.setTextColor(...brandDark);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("BILLED TO", margin + 8, 63);
        doc.text("INVOICE DATE", pageWidth / 2 + 2, 63);
        doc.text("TOTAL AMOUNT", pageWidth - margin - 8, 63, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(customerName, margin + 8, 73, { maxWidth: 70 });
        doc.text(invoiceDate.toLocaleDateString(), pageWidth / 2 + 2, 73);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(...brand);
        doc.text(`${total.toFixed(2)} RON`, pageWidth - margin - 8, 74, { align: "right" });
    }

    function drawTableHeader(y) {
        doc.setFillColor(...brand);
        doc.roundedRect(margin, y, tableWidth, 11, 2, 2, "F");
        doc.setTextColor(248, 250, 247);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Date", margin + 4, y + 7);
        doc.text("Location", margin + 44, y + 7);
        doc.text("Duration", margin + 101, y + 7);
        doc.text("Plate", margin + 128, y + 7);
        doc.text("Cost", pageWidth - margin - 4, y + 7, { align: "right" });
    }

    function drawTableRow(session, y, index) {
        const rowHeight = 12;
        if (index % 2 === 0) {
            doc.setFillColor(250, 252, 248);
            doc.rect(margin, y, tableWidth, rowHeight, "F");
        }

        doc.setDrawColor(...border);
        doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

        doc.setTextColor(...brandDark);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(formatDate(session.startTime), margin + 4, y + 7.5, { maxWidth: 37 });
        doc.text(session.parkingName || "Unknown", margin + 44, y + 7.5, { maxWidth: 52 });
        doc.text(`${session.durationHours || 0} h`, margin + 101, y + 7.5);
        doc.text(session.plateNumber || "N/A", margin + 128, y + 7.5, { maxWidth: 28 });

        doc.setFont("helvetica", "bold");
        doc.text(`${(session.totalCost || 0).toFixed(2)} RON`, pageWidth - margin - 4, y + 7.5, { align: "right" });
    }

    drawHeader();
    drawInfoCard();

    doc.setTextColor(...brandDark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Parking Session Details", pageWidth / 2, 103, { align: "center" });

    let pageNumber = 1;
    let y = 112;
    drawTableHeader(y);
    y += 11;

    sessions.forEach((session, index) => {
        if (y > 265) {
            drawFooter(pageNumber);
            doc.addPage();
            pageNumber += 1;
            drawHeader();
            y = 54;
            drawTableHeader(y);
            y += 11;
        }

        drawTableRow(session, y, index);
        y += 12;
    });

    y += 9;
    doc.setDrawColor(...brand);
    doc.line(pageWidth - 82, y, pageWidth - margin, y);
    doc.setTextColor(...brandDark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Invoice Total", pageWidth - 82, y + 10);
    doc.setTextColor(...brand);
    doc.setFontSize(14);
    doc.text(`${total.toFixed(2)} RON`, pageWidth - margin, y + 10, { align: "right" });

    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Thank you for using Park Sibiu.", pageWidth / 2, pageHeight - 30, { align: "center" });
    drawFooter(pageNumber);

    doc.save(`Invoice_ParkSibiu_${new Date().getMonth() + 1}.pdf`);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const sessions = await getHistory(user.uid);
        
        document.getElementById("generateInvoiceBtn").onclick = async () => {
            const total = parseFloat(document.getElementById("totalToPay").innerText);
            await generatePDF(sessions, total);
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
