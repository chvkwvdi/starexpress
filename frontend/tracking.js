document.addEventListener("DOMContentLoaded", function () {

    const trackForm = document.getElementById("trackForm");
    const trackingCodeInput = document.getElementById("trackingCodeInput");

    const errorCard = document.getElementById("errorCard");
    const resultSection = document.getElementById("resultSection");

    const displayCode = document.getElementById("displayCode");
    const statusBadge = document.getElementById("statusBadge");
    const displayRecipient = document.getElementById("displayRecipient");
    const displayDestination = document.getElementById("displayDestination");
    const displayLocation = document.getElementById("displayLocation");
    const displayService = document.getElementById("displayService");

    const timelineList = document.getElementById("timelineList");


    // =====================================================
let API_BASE = "https://star-express-api.onrender.com/api/shipments";

if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    API_BASE = "http://localhost:3000/api/shipments";
}


    // =====================================================
    // SHOW ERROR
    // =====================================================

    function showError(message) {
        if (resultSection) {
            resultSection.style.display = "none";
        }
        if (errorCard) {
            errorCard.style.display = "block";
            errorCard.innerHTML = `
                <i class="fa-solid fa-circle-exclamation" style="margin-right: 8px;"></i>
                ${escapeHtml(message)}
            `;
        }
    }


    // =====================================================
    // HIDE ERROR
    // =====================================================

    function hideError() {
        if (errorCard) {
            errorCard.style.display = "none";
        }
    }


    // =====================================================
    // TRACK SHIPMENT
    // =====================================================

    async function trackShipment(trackingCode) {
        hideError();
        if (resultSection) {
            resultSection.style.display = "none";
        }

        try {
            const response = await fetch(
                `${API_BASE}/${encodeURIComponent(trackingCode)}`
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Tracking code not found.");
            }

            displayShipment(data);
        } catch (error) {
            console.error("Tracking error:", error);
            showError(error.message || "Unable to connect to the shipment server.");
        }
    }


    // =====================================================
    // DISPLAY SHIPMENT
    // =====================================================

    function displayShipment(shipment) {
        hideError();
        if (resultSection) {
            resultSection.style.display = "block";
        }

        if (displayCode) {
            displayCode.textContent = shipment.trackingCode || "-";
        }

        if (statusBadge) {
            statusBadge.textContent = shipment.status || "Order Processed";
        }

        if (displayRecipient) {
            displayRecipient.textContent =
                shipment.receiverName || shipment.recipientName || "-";
        }

        if (displayDestination) {
            displayDestination.textContent = shipment.destination || "-";
        }

        if (displayLocation) {
            displayLocation.textContent =
                shipment.currentLocation || shipment.location || shipment.origin || "-";
        }

        if (displayService) {
            displayService.textContent =
                shipment.shippingService || shipment.shipmentType || "Standard Delivery";
        }

        // Render timeline keeping all history and appending a clean "Pending" next step
        renderTimeline(
            shipment.history || [],
            shipment.status,
            shipment.currentLocation || shipment.location || shipment.origin,
            shipment
        );
    }


    // =====================================================
    // RENDER TIMELINE (SAVED HISTORY + PENDING STAGE MASKING)
    // =====================================================

    function renderTimeline(history, currentStatus, currentLocation, shipment) {
        if (!timelineList) {
            return;
        }

        timelineList.innerHTML = "";

        // Collect all distinct status milestones saved in admin history
        let stagesSet = new Set();
        stagesSet.add("Order Processed");

        if (history && history.length > 0) {
            history.forEach(item => {
                if (item && item.status) {
                    stagesSet.add(item.status.trim());
                }
            });
        }

        if (currentStatus) {
            stagesSet.add(currentStatus.trim());
        }

        let stages = Array.from(stagesSet);

        // Standard logistics sequence to determine the next upcoming step automatically
        const standardFlow = [
            "Order Processed", 
            "Picked Up", 
            "In Transit", 
            "Customs Clearance", 
            "Out for Delivery", 
            "Delivered"
        ];

        let nextPendingStage = "Out for Delivery";
        const currentTrimmed = String(currentStatus || "").trim().toLowerCase();
        const currentIndexInFlow = standardFlow.findIndex(s => s.toLowerCase() === currentTrimmed);
        
        if (currentIndexInFlow !== -1 && currentIndexInFlow < standardFlow.length - 1) {
            nextPendingStage = standardFlow[currentIndexInFlow + 1];
        } else {
            if (currentTrimmed.includes("transit")) nextPendingStage = "Out for Delivery";
            else if (currentTrimmed.includes("out")) nextPendingStage = "Delivered";
            else if (currentTrimmed.includes("delivered")) {
                nextPendingStage = null; // Fully complete, no pending step needed
            }
        }

        // Append the next pending stage to the list if not already recorded
        if (nextPendingStage && !stages.some(s => s.toLowerCase() === nextPendingStage.toLowerCase())) {
            stages.push(nextPendingStage);
        }

        // Find current active index based on admin's status
        let activeIndex = stages.findIndex(
            s => s.toLowerCase() === currentTrimmed
        );
        if (activeIndex === -1) {
            activeIndex = 0;
        }

        // Map existing history for data retention
        const historyMap = new Map();
        if (history && history.length > 0) {
            history.forEach(item => {
                if (item && item.status) {
                    historyMap.set(item.status.trim().toLowerCase(), item);
                }
            });
        }

        stages.forEach(function (stage, index) {
            const timelineItem = document.createElement("div");

            let state = "pending";
            if (index < activeIndex) {
                state = "completed";
            } else if (index === activeIndex) {
                state = "active";
            } else {
                state = "pending";
            }

            timelineItem.className = `timeline-item ${state}`;

            const stageLower = stage.toLowerCase();
            const historyItem = historyMap.get(stageLower);

            let dateText = "Pending";
            let locationText = "Pending";
            let noteText = "Pending";
            // If the item is pending (future step), mask the stage name as well to read "Pending"
            let displayStageName = (state === 'pending') ? "Pending" : stage;

            if (historyItem) {
                dateText = formatDate(historyItem.timestamp);
                locationText = historyItem.location || currentLocation || "-";
                noteText = historyItem.note || "";
            } else if (index === activeIndex) {
                dateText = formatDate(shipment.updatedAt || shipment.timestamp);
                locationText = currentLocation || "-";
                noteText = shipment.notes || "Status updated.";
            } else {
                dateText = "Pending";
                locationText = "Pending";
                noteText = "Pending";
            }

            if (state === 'pending') {
                timelineItem.innerHTML = `
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-header-row">
                            <div class="timeline-status-text">
                                ${escapeHtml(displayStageName)}
                            </div>
                            <div class="timeline-time">
                                Pending
                            </div>
                        </div>
                        <div class="timeline-location">
                            <i class="fa-solid fa-location-dot" style="margin-right: 5px; color: #94a3b8;"></i>
                            Location: Pending
                        </div>
                        <div style="margin-top: 6px; font-size: 12px; color: #94a3b8;">
                            Message: Pending
                        </div>
                    </div>
                `;
            } else {
                timelineItem.innerHTML = `
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-header-row">
                            <div class="timeline-status-text">
                                ${escapeHtml(displayStageName)}
                            </div>
                            <div class="timeline-time">
                                ${escapeHtml(dateText)}
                            </div>
                        </div>
                        <div class="timeline-location">
                            <i class="fa-solid fa-location-dot" style="margin-right: 5px; color: #cc0000;"></i>
                            Location: ${escapeHtml(locationText)}
                        </div>
                        ${
                            noteText && noteText !== "Pending"
                            ? `<div style="margin-top: 6px; font-size: 12px; color: #64748b;">Message: ${escapeHtml(noteText)}</div>`
                            : ""
                        }
                    </div>
                `;
            }

            timelineList.appendChild(timelineItem);
        });

        updateTimelineProgress(activeIndex, stages.length);
    }


    // =====================================================
    // UPDATE TIMELINE PROGRESS LINE
    // =====================================================

    function updateTimelineProgress(activeIndex, totalItems) {
        if (!timelineList || totalItems <= 1) {
            if (timelineList) timelineList.style.setProperty("--progress", "0%");
            return;
        }

        // Freeze progress line strictly at the admin's current active stage
        const progress = (activeIndex / (totalItems - 1)) * 100;
        timelineList.style.setProperty(
            "--progress",
            `${Math.min(100, Math.max(0, progress))}%`
        );
    }


    // =====================================================
    // FORMAT DATE
    // =====================================================

    function formatDate(timestamp) {
        if (!timestamp) {
            return "Pending";
        }
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return "Pending";
        }
        return date.toLocaleString();
    }


    // =====================================================
    // PROTECT HTML
    // =====================================================

    function escapeHtml(value) {
        return String(value ?? "").replace(
            /[&<>'"]/g,
            function (character) {
                return {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    "'": "&#039;",
                    '"': "&quot;"
                }[character];
            }
        );
    }


    // =====================================================
    // TRACK FORM SUBMISSION
    // =====================================================

    if (trackForm) {
        trackForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const trackingCode = trackingCodeInput ? trackingCodeInput.value.trim() : "";
            if (!trackingCode) {
                showError("Please enter your tracking number.");
                return;
            }
            trackShipment(trackingCode);
        });
    }


    // =====================================================
    // AUTOMATIC TRACKING FROM URL PARAMETER
    // =====================================================

    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code");

    if (codeFromUrl) {
        const code = codeFromUrl.trim();
        if (trackingCodeInput) {
            trackingCodeInput.value = code;
        }
        if (code) {
            trackShipment(code);
        }
    }

});