const API_URL = '/api/shipments';
const DELIVERY_STAGES = ['Order Processed', 'In Transit', 'Arrived at Hub', 'Customs Clearance', 'Out for Delivery', 'Delivered'];

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('trackForm');
    const input = document.getElementById('trackingCodeInput');
    const result = document.getElementById('resultSection');
    const error = document.getElementById('errorCard');
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
    const formatDate = value => value ? new Date(value).toLocaleString() : 'Pending';

    async function track(code) {
        const response = await fetch(`${API_URL}/${encodeURIComponent(code)}`);
        const shipment = await readResponse(response);
        if (!response.ok) throw new Error(shipment.message || 'Tracking code not found.');
        document.getElementById('displayCode').textContent = shipment.trackingCode;
        document.getElementById('statusBadge').textContent = shipment.status;
        document.getElementById('displayRecipient').textContent = shipment.receiverName || '-';
        document.getElementById('displayDestination').textContent = shipment.destination || '-';
        document.getElementById('displayLocation').textContent = shipment.currentLocation || shipment.location || '-';
        document.getElementById('displayService').textContent = shipment.shippingService || shipment.shipmentType || '-';
        const history = shipment.history || [];
        const currentIndex = Math.max(0, DELIVERY_STAGES.indexOf(shipment.status));
        const latestByStatus = new Map();
        history.forEach(item => {
            if (DELIVERY_STAGES.indexOf(item.status) <= currentIndex) latestByStatus.set(item.status, item);
        });
        document.getElementById('timelineList').style.setProperty('--progress', `${currentIndex / (DELIVERY_STAGES.length - 1) * 100}%`);
        document.getElementById('timelineList').innerHTML = DELIVERY_STAGES.map((stage, index) => {
            const item = latestByStatus.get(stage);
            const reached = index < currentIndex;
            const active = index === currentIndex;
            return `<div class="timeline-item ${reached ? 'completed' : active ? 'active' : 'pending'}"><div class="timeline-dot"></div><div class="timeline-content"><div class="timeline-header-row"><span class="timeline-status-text">${escapeHtml(stage)}</span><span class="timeline-time">${item ? escapeHtml(formatDate(item.timestamp || item.time)) : 'Waiting for admin update'}</span></div><div class="timeline-location"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(item?.location || shipment.currentLocation || 'Pending')}</div>${item?.note ? `<p>${escapeHtml(item.note)}</p>` : ''}</div></div>`;
        }).join('');
        error.style.display = 'none';
        result.style.display = 'block';
        window.translateCurrentPage?.();
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function readResponse(response) {
        const text = await response.text();
        if (!text.trim()) throw new Error(`Server returned an empty response (${response.status}).`);
        try { return JSON.parse(text); }
        catch (error) { throw new Error(`Server returned invalid tracking data (${response.status}).`); }
    }

    function showTrackingError(error) {
        result.style.display = 'none';
        errorCard.textContent = error.message || 'Tracking code not found. Please verify your reference number and try again.';
        errorCard.style.display = 'block';
    }

    const errorCard = error;
    form?.addEventListener('submit', event => {
        event.preventDefault();
        const code = input.value.trim();
        if (!code) return;
        track(code).catch(showTrackingError);
    });
    const initialCode = new URLSearchParams(window.location.search).get('tracking');
    if (initialCode) { input.value = initialCode; track(initialCode).catch(showTrackingError); }
});
