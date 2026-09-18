const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'backend', 'shipments.json');
const EMAILJS_SERVICE_ID = 'service_zkfo8d3';
const EMAILJS_TEMPLATE_ID = 'template_08qdtfh';
const EMAILJS_PUBLIC_KEY = 't5oS1glghLyDbCZMH';
const DELIVERY_STAGES = ['Order Processed', 'In Transit', 'Arrived at Hub', 'Customs Clearance', 'Out for Delivery', 'Delivered'];

app.use(express.json());
app.use(express.static(__dirname));

const mailTransporter = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
    : null;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[character]));
}

function getEmailConfiguration() {
    if (!mailTransporter) {
        return {
            configured: false,
            message: 'Email is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to .env, then restart the server.'
        };
    }
    return { configured: true, message: 'SMTP email provider is configured.' };
}

async function sendShipmentEmail(shipment, message) {
    if (!shipment.userEmail) throw new Error('This shipment has no recipient email address.');
    if (!mailTransporter) throw new Error(getEmailConfiguration().message);
    const safeMessage = escapeHtml(message || 'Your shipment information has been updated.');
    await mailTransporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: shipment.userEmail,
        subject: `Shipment update: ${shipment.trackingCode} is ${shipment.status}`,
        text: [
            `Tracking number: ${shipment.trackingCode}`,
            `Status: ${shipment.status}`,
            `Current location: ${shipment.currentLocation}`,
            '',
            message || 'Your shipment information has been updated.'
        ].join('\n'),
        html: `<h2>Star Express Shipment Update</h2><p><strong>Tracking number:</strong> ${escapeHtml(shipment.trackingCode)}</p><p><strong>Status:</strong> ${escapeHtml(shipment.status)}</p><p><strong>Current location:</strong> ${escapeHtml(shipment.currentLocation)}</p><p>${safeMessage}</p>`
    });
    return { sent: true, recipient: shipment.userEmail };
}

async function sendEmailJsNotification(shipment, message) {
    if (!shipment.userEmail) throw new Error('This shipment has no recipient email address.');
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: {
                to_email: shipment.userEmail,
                to_name: shipment.receiverName,
                name: 'Star Express Logistics',
                tracking_code: shipment.trackingCode,
                status: shipment.status,
                location: shipment.currentLocation || shipment.location,
                custom_message: message || 'Your shipment information has been updated.',
                time: new Date().toLocaleString()
            }
        })
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`EmailJS rejected the notification (${response.status}): ${responseText || 'Unknown provider error.'}`);
    return { sent: true, recipient: shipment.userEmail };
}

async function readShipments() {
    try {
        const contents = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(contents || '[]').map(item => ({
            ...item,
            receiverName: item.receiverName || item.recipientName || '',
            userEmail: item.userEmail || item.receiverEmail || '',
            currentLocation: item.currentLocation || item.location || item.origin || '',
            location: item.currentLocation || item.location || item.origin || ''
        }));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await fs.writeFile(DATA_FILE, '[]', 'utf8');
        return [];
    }
}

async function writeShipments(shipments) {
    await fs.writeFile(DATA_FILE, JSON.stringify(shipments, null, 2), 'utf8');
}

function normalizeShipment(input) {
    const now = new Date().toISOString();
    const trackingCode = String(input.trackingCode || '').trim();
    const currentLocation = String(input.currentLocation || input.location || input.origin || '').trim();
    const destination = String(input.destination || '').replace(/\s+(Save Order to Records|Create Shipment)\s*$/i, '').trim();
    return {
        trackingCode,
        senderName: String(input.senderName || '').trim(),
        receiverName: String(input.receiverName || input.recipientName || '').trim(),
        userEmail: String(input.userEmail || input.receiverEmail || '').trim(),
        origin: String(input.origin || '').trim(),
        destination,
        currentLocation,
        location: currentLocation,
        status: String(input.status || 'Order Processed').trim(),
        shipmentType: String(input.shipmentType || 'International Express').trim(),
        shippingService: String(input.shippingService || 'Standard Delivery').trim(),
        packageWeight: String(input.packageWeight || '').trim(),
        estimatedDelivery: String(input.estimatedDelivery || '').trim(),
        packageDescription: String(input.packageDescription || '').trim(),
        notes: String(input.notes || '').trim(),
        createdAt: input.createdAt || now,
        updatedAt: now,
        history: Array.isArray(input.history) && input.history.length ? input.history : [{
            status: String(input.status || 'Order Processed').trim(),
            location: currentLocation,
            timestamp: now,
            note: 'Shipment registered.'
        }]
    };
}

function stageIndex(status) {
    return DELIVERY_STAGES.indexOf(status);
}

app.get('/api/shipments', async (req, res) => {
    try { res.json(await readShipments()); }
    catch (error) { console.error(error); res.status(500).json({ message: 'Unable to load shipments.' }); }
});

app.get('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const code = req.params.trackingCode.toLowerCase();
        const shipment = (await readShipments()).find(item => item.trackingCode.toLowerCase() === code);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
        res.json(shipment);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to load shipment.' }); }
});

app.post('/api/shipments', async (req, res) => {
    try {
        const shipment = normalizeShipment(req.body);
        if (!shipment.trackingCode || !shipment.receiverName || !shipment.destination) return res.status(400).json({ message: 'Tracking code, receiver, and destination are required.' });
        const shipments = await readShipments();
        if (shipments.some(item => item.trackingCode.toLowerCase() === shipment.trackingCode.toLowerCase())) return res.status(409).json({ message: 'That tracking code already exists.' });
        shipments.push(shipment);
        await writeShipments(shipments);
        res.status(201).json(shipment);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to create shipment.' }); }
});

app.delete('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const shipments = await readShipments();
        const index = shipments.findIndex(item => item.trackingCode.toLowerCase() === req.params.trackingCode.toLowerCase());
        if (index === -1) return res.status(404).json({ message: 'Shipment not found.' });
        const [deleted] = shipments.splice(index, 1);
        await writeShipments(shipments);
        res.json({ success: true, trackingCode: deleted.trackingCode });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Unable to delete shipment.' });
    }
});

app.patch('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const shipments = await readShipments();
        const index = shipments.findIndex(item => item.trackingCode.toLowerCase() === req.params.trackingCode.toLowerCase());
        if (index === -1) return res.status(404).json({ message: 'Shipment not found.' });
        const current = shipments[index];
        const status = String(req.body.status || current.status).trim();
        const location = String(req.body.currentLocation || req.body.location || current.currentLocation || '').trim();
        const currentStage = stageIndex(current.status);
        const nextStage = stageIndex(status);
        if (nextStage === -1) return res.status(400).json({ message: 'Invalid delivery stage.' });
        if (nextStage > currentStage + 1) return res.status(409).json({ message: `Move the shipment to ${DELIVERY_STAGES[currentStage + 1]} before selecting ${status}.` });
        if (nextStage < currentStage) return res.status(409).json({ message: 'Delivery progress cannot move backwards.' });
        const updatedAt = new Date().toISOString();
        shipments[index] = { ...current, status, location, currentLocation: location, updatedAt, history: [...(current.history || []), { status, location, timestamp: updatedAt, note: String(req.body.customMessage || '').trim() }] };
        await writeShipments(shipments);
        let emailSent = false;
        let emailRecipient = '';
        let emailError = '';
        if (!req.body.skipEmail) {
            try {
                const emailResult = req.body.emailProvider === 'emailjs'
                    ? await sendEmailJsNotification(shipments[index], req.body.customMessage)
                    : await sendShipmentEmail(shipments[index], req.body.customMessage);
                emailSent = emailResult.sent;
                emailRecipient = emailResult.recipient;
            } catch (error) {
                console.error('Shipment email failed:', error.message);
                emailError = error.message;
            }
        }
        res.json({ ...shipments[index], emailSent, emailRecipient, emailConfigured: Boolean(mailTransporter), emailError });
    } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to update shipment.' }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.get(['/tracking.html', '/tracking/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'tracking.html')));
app.get('/services.html', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'services.html')));
app.get('/contact.html', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'contact.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'backend', 'admin.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'backend', 'admin.html')));
app.get('/api/health', (req, res) => res.json({ ok: true, email: getEmailConfiguration() }));

app.get('/api/translate', async (req, res) => {
    const text = String(req.query.text || '').trim();
    const language = String(req.query.language || 'en').trim();
    if (!text || language === 'en') return res.json({ text });
    try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(language)}`);
        if (!response.ok) return res.status(502).json({ message: 'Translation provider unavailable.' });
        const result = await response.json();
        const translated = result?.responseData?.translatedText;
        if (!translated) return res.status(502).json({ message: 'Translation provider returned no text.' });
        res.json({ text: translated });
    } catch (error) {
        console.error('Translation failed:', error.message);
        res.status(502).json({ message: 'Translation provider unavailable.' });
    }
});

app.listen(PORT, () => console.log(`Star Express server running at http://localhost:${PORT}`));
