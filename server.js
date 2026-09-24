const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const cors = require('cors');

const app = express();

// Middleware setup - allows requests from Live Server or any origin with credentials
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl) or any localhost port
        return callback(null, true);
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve static assets from frontend and backend directories
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/backend', express.static(path.join(__dirname, 'backend')));

const PORT = process.env.PORT || 3000;
const BACKEND_DIR = path.join(__dirname, 'backend');
const DATA_FILE = path.join(BACKEND_DIR, 'shipments.json');

// Ensure storage files exist
async function ensureStorage() {
    try {
        await fs.mkdir(BACKEND_DIR, { recursive: true });
        try {
            await fs.access(DATA_FILE);
        } catch {
            await fs.writeFile(DATA_FILE, '[]', 'utf8');
        }
    } catch (err) {
        console.error('Failed to initialize storage:', err);
    }
}
ensureStorage();

// Nodemailer setup
const mailTransporter = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { 
            user: process.env.SMTP_USER, 
            pass: process.env.SMTP_PASS 
        }
    })
    : null;

async function sendShipmentEmail(shipment, message) {
    if (!mailTransporter || !shipment.userEmail) return false;
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
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #e63946;">Star Express Shipment Update</h2>
                <p><strong>Tracking number:</strong> ${shipment.trackingCode}</p>
                <p><strong>Status:</strong> ${shipment.status}</p>
                <p><strong>Current location:</strong> ${shipment.currentLocation}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p>${message || 'Your shipment information has been updated.'}</p>
            </div>
        `
    });
    return true;
}

async function readShipments() {
    try {
        await ensureStorage();
        const contents = await fs.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(contents || '[]');
        return Array.isArray(parsed) ? parsed.map(item => ({
            ...item,
            receiverName: item.receiverName || item.recipientName || '',
            userEmail: item.userEmail || item.receiverEmail || '',
            currentLocation: item.currentLocation || item.location || item.origin || '',
            location: item.currentLocation || item.location || item.origin || ''
        })) : [];
    } catch (error) {
        return [];
    }
}

async function writeShipments(shipments) {
    await ensureStorage();
    await fs.writeFile(DATA_FILE, JSON.stringify(shipments, null, 2), 'utf8');
}

function normalizeShipment(input) {
    const now = new Date().toISOString();
    const trackingCode = String(input.trackingCode || '').trim();
    const currentLocation = String(input.currentLocation || input.location || input.origin || '').trim();
    return {
        trackingCode,
        senderName: String(input.senderName || '').trim(),
        receiverName: String(input.receiverName || input.recipientName || '').trim(),
        userEmail: String(input.userEmail || input.receiverEmail || '').trim(),
        origin: String(input.origin || '').trim(),
        destination: String(input.destination || '').trim(),
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

// ==========================
// Authentication API Route
// ==========================

app.post('/api/admin-login', (req, res) => {
    const { email, password } = req.body || {};
    const inputEmail = String(email || '').trim();
    const inputPassword = String(password || '').trim();
    
    const adminEmail = String(process.env.ADMIN_EMAIL || 'burgerben78@gmail.com').trim();
    const adminPassword = String(process.env.ADMIN_PASSWORD || 'Goodness44').trim();

    if (inputEmail === adminEmail && inputPassword === adminPassword) {
        res.cookie('admin_auth', 'true', {
            httpOnly: true,
            secure: false, // set to true if using HTTPS in production
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        return res.json({ success: true, message: 'Login successful' });
    }
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
});

app.get('/admin-logout', (req, res) => {
    res.clearCookie('admin_auth');
    res.redirect('/admin_3.html');
});

// ==========================
// Shipment & Tracking API Routes
// ==========================

app.get('/api/shipments', async (req, res) => {
    try { 
        res.json(await readShipments()); 
    } catch (error) { 
        res.status(500).json({ message: 'Unable to load shipments.' }); 
    }
});

app.get('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const code = req.params.trackingCode.toLowerCase();
        const shipment = (await readShipments()).find(item => item.trackingCode.toLowerCase() === code);
        if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
        res.json(shipment);
    } catch (error) { 
        res.status(500).json({ message: 'Unable to load shipment.' }); 
    }
});

app.post('/api/shipments', async (req, res) => {
    try {
        const shipment = normalizeShipment(req.body);
        if (!shipment.trackingCode || !shipment.receiverName || !shipment.destination) {
            return res.status(400).json({ message: 'Tracking code, receiver, and destination are required.' });
        }
        const shipments = await readShipments();
        if (shipments.some(item => item.trackingCode.toLowerCase() === shipment.trackingCode.toLowerCase())) {
            return res.status(409).json({ message: 'That tracking code already exists.' });
        }
        shipments.push(shipment);
        await writeShipments(shipments);
        res.status(201).json(shipment);
    } catch (error) { 
        res.status(500).json({ message: 'Unable to create shipment.' }); 
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
        const updatedAt = new Date().toISOString();
        
        shipments[index] = { 
            ...current, 
            status, 
            location, 
            currentLocation: location, 
            updatedAt, 
            history: [
                ...(current.history || []), 
                { 
                    status, 
                    location, 
                    timestamp: updatedAt, 
                    note: String(req.body.customMessage || '').trim() 
                }
            ] 
        };
        
        await writeShipments(shipments);
        
        let emailSent = false;
        let emailError = '';
        try {
            emailSent = await sendShipmentEmail(shipments[index], req.body.customMessage);
        } catch (error) {
            emailError = 'Shipment saved, but email dispatch failed.';
        }
        
        res.json({ ...shipments[index], emailSent, emailConfigured: Boolean(mailTransporter), emailError });
    } catch (error) { 
        res.status(500).json({ message: 'Unable to update shipment.' }); 
    }
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
        res.status(500).json({ message: 'Unable to delete shipment.' });
    }
});

app.get('/api/health', (req, res) => res.json({ ok: true, emailConfigured: Boolean(mailTransporter) }));

// ==========================
// Page Routing & Protection
// ==========================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.get('/tracking.html', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'tracking.html')));

// Serve admin_3.html as the login page
app.get(['/admin_3.html', '/admin-login.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'backend', 'admin_3.html'));
});

// Protect admin.html (Dashboard) - Only accessible if cookie is set
app.get(['/admin.html', '/admin'], (req, res) => {
    if (req.cookies && req.cookies.admin_auth === 'true') {
        return res.sendFile(path.join(__dirname, 'backend', 'admin.html'));
    }
    res.redirect('/admin_3.html');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Star Express server running at http://localhost:${PORT}`);
});