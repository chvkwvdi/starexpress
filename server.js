const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const cors = require('cors');

const app = express();

// ==========================
// Middleware & CORS Setup
// ==========================
app.use(cors({
    origin: function(origin, callback) {
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// ==========================
// Static File Routing (Fixed Paths)
// ==========================
// Serve frontend files (if any)
app.use(express.static(path.join(__dirname, 'frontend')));
// Serve backend files directly so admin.html and admin.js can load scripts properly
app.use(express.static(path.join(__dirname, 'backend')));
app.use('/backend', express.static(path.join(__dirname, 'backend')));

const PORT = process.env.PORT || 3000;
const BACKEND_DIR = __dirname;
const DATA_FILE = path.join(BACKEND_DIR, 'shipments.json');

// Ensure storage file exists
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
    if (!mailTransporter || (!shipment.userEmail && !shipment.receiverEmail)) return false;
    const recipient = shipment.userEmail || shipment.receiverEmail;
    await mailTransporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: recipient,
        subject: `Shipment update: ${shipment.trackingCode} is ${shipment.status}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #e63946;">Star Express Shipment Update</h2>
                <p><strong>Tracking Number:</strong> ${shipment.trackingCode}</p>
                <p><strong>Current Status:</strong> ${shipment.status}</p>
                <p><strong>Current Location:</strong> ${shipment.currentLocation || shipment.location}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p><strong>Message from Logistics Team:</strong></p>
                <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #e63946; margin: 0;">
                    ${message || 'Your shipment information has been updated.'}
                </blockquote>
                <p style="margin-top: 20px; font-size: 0.9em; color: #777;">Thank you for choosing Star Express.</p>
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
        if (error.code === 'ENOENT') {
            await fs.writeFile(DATA_FILE, '[]', 'utf8');
            return [];
        }
        return [];
    }
}

async function writeShipments(shipments) {
    await ensureStorage();
    await fs.writeFile(DATA_FILE, JSON.stringify(shipments, null, 2), 'utf8');
}

// ==========================
// Authentication API Routes
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
            secure: true, 
            sameSite: 'none', 
            maxAge: 24 * 60 * 60 * 1000 
        });
        return res.json({ success: true, message: 'Login successful' });
    }
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
});

app.get('/admin-logout', (req, res) => {
    res.clearCookie('admin_auth', { sameSite: 'none', secure: true });
    res.redirect('/admin_3.html');
});

// ==========================
// Shipment & Tracking API Routes
// ==========================

app.get('/api/shipments', async (req, res) => {
    try {
        const shipments = await readShipments();
        res.json(shipments);
    } catch (error) {
        console.error('Error reading shipments:', error);
        res.status(500).json({ success: false, message: 'Unable to load shipments.' });
    }
});

app.get('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const shipments = await readShipments();
        const code = req.params.trackingCode.trim().toLowerCase();
        const shipment = shipments.find(s => s.trackingCode.trim().toLowerCase() === code);
        
        if (!shipment) {
            return res.status(404).json({ success: false, message: 'Tracking code not found.' });
        }
        res.json(shipment);
    } catch (error) {
        console.error('Error reading shipment:', error);
        res.status(500).json({ success: false, message: 'Server error loading shipment.' });
    }
});

app.post('/api/shipments', async (req, res) => {
    try {
        const input = req.body;
        const now = new Date().toISOString();
        const trackingCode = String(input.trackingCode || '').trim();
        const currentLocation = String(input.currentLocation || input.location || input.origin || '').trim();
        
        if (!trackingCode || !input.receiverName || !input.destination) {
            return res.status(400).json({ success: false, message: 'Tracking code, receiver, and destination are required.' });
        }

        const shipments = await readShipments();
        if (shipments.some(item => item.trackingCode.toLowerCase() === trackingCode.toLowerCase())) {
            return res.status(409).json({ success: false, message: 'That tracking code already exists.' });
        }

        const newShipment = {
            trackingCode,
            senderName: String(input.senderName || '').trim(),
            receiverName: String(input.receiverName || '').trim(),
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
            createdAt: now,
            updatedAt: now,
            history: [{
                status: String(input.status || 'Order Processed').trim(),
                location: currentLocation,
                timestamp: now,
                note: 'Shipment registered.'
            }]
        };

        shipments.push(newShipment);
        await writeShipments(shipments);
        res.status(201).json(newShipment);
    } catch (error) {
        console.error('Error creating shipment:', error);
        res.status(500).json({ success: false, message: 'Unable to create shipment.' });
    }
});

app.patch('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const code = req.params.trackingCode.trim().toLowerCase();
        const { status, currentLocation, location, customMessage } = req.body;
        const pos = currentLocation || location || 'In Transit';

        const shipments = await readShipments();
        const index = shipments.findIndex(s => s.trackingCode.trim().toLowerCase() === code);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Shipment not found in database.' });
        }

        const current = shipments[index];
        const updatedAt = new Date().toISOString();
        
        current.status = status || current.status;
        current.currentLocation = pos;
        current.location = pos;
        current.updatedAt = updatedAt;
        
        if (!current.history) current.history = [];
        current.history.push({
            status: current.status,
            location: pos,
            timestamp: updatedAt,
            note: customMessage || 'Status updated by logistics team.'
        });

        shipments[index] = current;
        await writeShipments(shipments);

        let emailSent = false;
        try {
            emailSent = await sendShipmentEmail(current, customMessage);
        } catch (emailErr) {
            console.error("Email dispatch warning:", emailErr.message);
        }

        res.status(200).json({ ...current, emailSent });
    } catch (error) {
        console.error("Error updating shipment:", error);
        res.status(500).json({ success: false, message: "Failed to update shipment." });
    }
});

app.delete('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const code = req.params.trackingCode.trim().toLowerCase();
        let shipments = await readShipments();
        const index = shipments.findIndex(s => s.trackingCode.trim().toLowerCase() === code);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Shipment not found.' });
        }

        const deleted = shipments[index];
        shipments = shipments.filter(s => s.trackingCode.trim().toLowerCase() !== code);
        await writeShipments(shipments);

        res.json({ success: true, trackingCode: deleted.trackingCode, message: 'Shipment deleted successfully.' });
    } catch (error) {
        console.error('Error deleting shipment:', error);
        res.status(500).json({ success: false, message: 'Unable to delete shipment.' });
    }
});

app.get('/api/health', (req, res) => res.json({ ok: true, emailConfigured: Boolean(mailTransporter) }));

// ==========================
// Page Routing & Protection
// ==========================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

app.get(['/admin_3.html', '/admin-login.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'backend', 'admin_3.html'));
});

app.get(['/admin.html', '/admin'], (req, res) => {
    if (req.cookies && req.cookies.admin_auth === 'true') {
        return res.sendFile(path.join(__dirname, 'backend', 'admin.html'));
    }
    res.redirect('/admin_3.html');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Star Express server running at http://localhost:${PORT}`);
});