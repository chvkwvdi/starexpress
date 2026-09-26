let API_URL = 'https://starexpress-qxi0.onrender.com/api/shipments';

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_URL = 'http://localhost:3000/api/shipments';
}

const EMAILJS_SERVICE_ID = 'service_zkfo8d3';
const EMAILJS_TEMPLATE_ID = 'template_08qdtfh';

document.addEventListener('DOMContentLoaded', () => {
    const createForm = document.getElementById('createShipmentForm');
    const createMessage = document.getElementById('createResponseMsg');
    const trackingInput = document.getElementById('newTrackingCode');
    const listButton = document.getElementById('loadActiveShipmentsBtn');
    const shipmentsContainer = document.getElementById('activeShipmentsContainer');
    const shipmentCount = document.getElementById('shipmentCount');
    const updateForm = document.getElementById('adminUpdateForm');
    const updateMessage = document.getElementById('updateResponseMsg');
    
    const generateTrackingCode = () => `SE${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
    if (trackingInput) {
        trackingInput.value = generateTrackingCode();
    }
    
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));

    async function readResponse(response) {
        const text = await response.text();
        if (!text.trim()) return {};
        try { return JSON.parse(text); }
        catch (error) { throw new Error(`Server returned invalid data (${response.status}).`); }
    }

    async function getShipments() {
        const response = await fetch(API_URL, { credentials: 'include' });
        const result = await readResponse(response);
        if (!response.ok) throw new Error(result.message || 'Unable to load shipments.');
        return Array.isArray(result) ? result : [];
    }

    async function sendEmailJsFromBrowser(shipment, message) {
        if (typeof emailjs === 'undefined') {
            throw new Error('EmailJS is not loaded.');
        }
        if (!shipment.userEmail) {
            throw new Error('This shipment has no recipient email address.');
        }
        const params = {
            to_email: shipment.userEmail,
            to_name: shipment.receiverName,
            name: 'Star Express Logistics',
            tracking_code: shipment.trackingCode,
            status: shipment.status,
            location: shipment.currentLocation || shipment.location,
            custom_message: message || 'Your shipment information has been updated.',
            time: new Date().toLocaleString()
        };
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
    }

    function updatePreview() {
        const statusEl = document.getElementById('editStatus');
        const trackingEl = document.getElementById('editTrackingCode');
        const posEl = document.getElementById('editCurrentPosition');
        const msgEl = document.getElementById('customEmailMessage');

        if (document.getElementById('prevBadge')) document.getElementById('prevBadge').textContent = statusEl ? statusEl.value : '';
        if (document.getElementById('prevTracking')) document.getElementById('prevTracking').textContent = trackingEl ? trackingEl.value || '--' : '--';
        if (document.getElementById('prevPosition')) document.getElementById('prevPosition').textContent = posEl ? posEl.value || '--' : '--';
        if (document.getElementById('prevMessage')) document.getElementById('prevMessage').textContent = msgEl ? msgEl.value || '--' : '--';
    }

    function selectShipment(shipment) {
        document.getElementById('editTrackingCode').value = shipment.trackingCode;
        document.getElementById('editUserEmail').value = shipment.userEmail || '';
        document.getElementById('editStatus').value = shipment.status;
        document.getElementById('editCurrentPosition').value = shipment.currentLocation || shipment.location || '';
        updatePreview();
        document.getElementById('editNotificationSection').scrollIntoView({ behavior: 'smooth' });
    }

    function renderShipments(shipments) {
        if (shipmentCount) shipmentCount.textContent = shipments.length;
        if (shipmentsContainer) {
            shipmentsContainer.style.display = 'block';
            shipmentsContainer.innerHTML = shipments.length ? shipments.map(shipment => `
                <article class="active-shipment-item">
                    <div class="shipment-meta">
                        <div>
                            <span class="badge-code">${escapeHtml(shipment.trackingCode)}</span> 
                            <strong>${escapeHtml(shipment.receiverName)}</strong> 
                            <span>(${escapeHtml(shipment.userEmail)})</span>
                        </div>
                        <span class="badge-status">${escapeHtml(shipment.status)}</span>
                    </div>
                    <div class="progress-indicator">
                        <span><i class="fas fa-map-marker-alt"></i> <strong>Current Position:</strong> ${escapeHtml(shipment.currentLocation || shipment.location)}</span>
                        <span><strong>Destination:</strong> ${escapeHtml(shipment.destination)}</span>
                    </div>
                    <div class="shipment-actions">
                        <button type="button" class="btn edit-shipment" data-code="${escapeHtml(shipment.trackingCode)}"><i class="fas fa-edit"></i> Edit Position</button>
                        <button type="button" class="btn btn-danger delete-shipment" data-code="${escapeHtml(shipment.trackingCode)}"><i class="fas fa-trash"></i> Delete Shipment</button>
                    </div>
                </article>
            `).join('') : '<p>No shipments found.</p>';
            
            shipmentsContainer.querySelectorAll('.edit-shipment').forEach(button => {
                button.addEventListener('click', () => {
                    const match = shipments.find(item => item.trackingCode === button.dataset.code);
                    if (match) selectShipment(match);
                });
            });

            shipmentsContainer.querySelectorAll('.delete-shipment').forEach(button => {
                button.addEventListener('click', async () => {
                    if (!window.confirm(`Delete shipment ${button.dataset.code}? This cannot be undone.`)) return;
                    button.disabled = true;
                    try {
                        const response = await fetch(`${API_URL}/${encodeURIComponent(button.dataset.code)}`, { 
                            method: 'DELETE',
                            credentials: 'include'
                        });
                        const result = await readResponse(response);
                        if (!response.ok) throw new Error(result.message || 'Unable to delete shipment.');
                        await loadShipments();
                        if (updateMessage) updateMessage.textContent = `Shipment ${result.trackingCode} deleted successfully.`;
                    } catch (error) {
                        button.disabled = false;
                        if (updateMessage) updateMessage.textContent = error.message;
                    }
                });
            });
        }
    }

    async function loadShipments() {
        try { 
            const data = await getShipments();
            renderShipments(data); 
        } catch (error) { 
            if (shipmentsContainer) {
                shipmentsContainer.style.display = 'block'; 
                shipmentsContainer.innerHTML = `<p>${escapeHtml(error.message)}</p>`; 
            }
        }
    }

    createForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const shipment = { 
            trackingCode: trackingInput.value, 
            senderName: document.getElementById('senderName').value, 
            receiverName: document.getElementById('receiverName').value, 
            userEmail: document.getElementById('receiverEmail').value, 
            origin: document.getElementById('originLocation').value, 
            destination: document.getElementById('destinationLocation').value 
        };
        try {
            createMessage.textContent = 'Saving order...';
            const response = await fetch(API_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                credentials: 'include',
                body: JSON.stringify(shipment) 
            });
            const result = await readResponse(response);
            if (!response.ok) throw new Error(result.message);
            createMessage.textContent = `Shipment created successfully! Tracking code: ${result.trackingCode}`;
            createForm.reset();
            trackingInput.value = generateTrackingCode();
            await loadShipments();
        } catch (error) { createMessage.textContent = error.message; }
    });

    ['editStatus', 'editCurrentPosition', 'customEmailMessage'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('input', updatePreview);
        el?.addEventListener('change', updatePreview);
    });
    
    listButton?.addEventListener('click', loadShipments);
    loadShipments();
    
    updateForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const code = document.getElementById('editTrackingCode').value;
        if (!code) { updateMessage.textContent = 'Select a shipment first.'; return; }
        try {
            const customMessage = document.getElementById('customEmailMessage').value;
            updateMessage.textContent = 'Saving shipment update & sending email...';
            const response = await fetch(`${API_URL}/${encodeURIComponent(code)}`, { 
                method: 'PATCH', 
                headers: { 'Content-Type': 'application/json' }, 
                credentials: 'include',
                body: JSON.stringify({ 
                    status: document.getElementById('editStatus').value, 
                    currentLocation: document.getElementById('editCurrentPosition').value, 
                    customMessage 
                }) 
            });
            const result = await readResponse(response);
            if (!response.ok) throw new Error(result.message);

            // Trigger immediate EmailJS notification from browser
            try {
                await sendEmailJsFromBrowser(result, customMessage);
                updateMessage.textContent = `Successfully updated and email sent to ${result.userEmail}!`;
            } catch (emailError) {
                updateMessage.textContent = `Shipment saved on server, but email notification had an issue: ${emailError.message}`;
            }
            await loadShipments();
        } catch (error) { updateMessage.textContent = error.message; }
    });
});