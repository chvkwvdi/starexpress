const express = require('express');
const mongoose = require('mongoose');
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
// Database Connection (MongoDB Atlas)
// ==========================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://expressstar846_db_user:St8MRCLoI09flxQz@cluster0.your-cluster-url.mongodb.net/starexpress?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define Shipment Schema & Model
const shipmentSchema = new mongoose.Schema({
    trackingCode: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senderName: { type: String, default: '' },
    receiverName: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    origin: { type: String, default: '' },
    destination: { type: String, required: true },
    currentLocation: { type: String, default: '' },
    location: { type: String, default: '' },
    status: { type: String, default: 'Order Processed' },
    shipmentType: { type: String, default: 'International Express' },
    shippingService: { type: String, default: 'Standard Delivery' },
    packageWeight: { type: String, default: '' },
    estimatedDelivery: { type: String, default: '' },
    packageDescription: { type: String, default: '' },
    notes: { type: String, default: '' },
    history: [{
        status: String,
        location: String,
        timestamp: { type: Date, default: Date.now },
        note: String
    }]
}, { timestamps: true });

const Shipment = mongoose.model('Shipment', shipmentSchema);

// ==========================
// Static File Routing
// ==========================
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'backend')));
app.use('/backend', express.static(path.join(__dirname, 'backend')));

const PORT = process.env.PORT || 3000;

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

async function sendShipmentEmail(shipment, customMessage) {
    if (!mailTransporter) {
        console.log("Email dispatch skipped: Mail transporter not configured.");
        return false;
    }
    
    const recipient = shipment.userEmail || shipment.receiverEmail;
    if (!recipient) {
        console.log("Email dispatch skipped: No recipient email provided.");
        return false;
    }

    try {
        await mailTransporter.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to: recipient,
            subject: `Shipment Update: ${shipment.trackingCode.toUpperCase()} is ${shipment.status}`,
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Star Express - Shipment Update</title>
                <style>
                    body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
                    .email-wrapper { width: 100%; background-color: #f4f6f9; padding: 40px 16px; }
                    .email-container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
                    .header-section { background: linear-gradient(135deg, #090d16 0%, #161e2e 100%); padding: 36px 40px; border-bottom: 4px solid #dc2626; }
                    .brand-title { font-size: 18px; font-weight: 800; color: #ffffff; }
                    .brand-subtitle { font-size: 9.5px; font-weight: 700; color: #fca5a5; letter-spacing: 2.5px; text-transform: uppercase; margin-top: 4px; }
                    .header-headline { font-size: 22px; font-weight: 700; color: #ffffff; margin: 20px 0 0 0; }
                    .body-content { padding: 40px; }
                    .tracking-card { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 5px solid #0f172a; border-radius: 12px; padding: 22px 24px; margin-bottom: 28px; }
                    .tracking-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 6px; }
                    .tracking-code { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: 1px; }
                    .status-module { background-color: #0f172a; border-left: 5px solid #dc2626; border-radius: 0 10px 10px 0; padding: 18px 22px; margin: 24px 0; }
                    .status-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
                    .status-value { font-size: 14px; font-weight: 700; color: #ffffff; }
                    .notes-module { background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #0284c7; border-radius: 0 10px 10px 0; padding: 18px 22px; margin-bottom: 32px; }
                    .notes-heading { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.9px; color: #0369a1; margin-bottom: 6px; }
                    .notes-body { font-size: 12.5px; line-height: 1.6; color: #475569; margin: 0; }
                    .footer-section { background-color: #f8fafc; padding: 32px 40px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <div class="email-container">
                        <div class="header-section">
                            <div class="brand-title">Star Express</div>
                            <div class="brand-subtitle">Courier & Logistics</div>
                            <h1 class="header-headline">Shipment Status Update</h1>
                        </div>
                        <div class="body-content">
                            <p style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 0;">Hello ${shipment.receiverName || 'Valued Customer'},</p>
                            <p style="font-size: 13.5px; line-height: 1.65; color: #475569;">Your shipping manifest has successfully advanced across our global logistics transit pipeline. Review your status milestones below.</p>
                            
                            <div class="tracking-card">
                                <div class="tracking-label">Tracking Reference Number</div>
                                <div class="tracking-code">${shipment.trackingCode.toUpperCase()}</div>
                            </div>

                            <p style="font-size: 13px; color: #334155;"><strong>Destination:</strong> ${shipment.destination}</p>
                            <p style="font-size: 13px; color: #334155;"><strong>Current Location:</strong> ${shipment.currentLocation || shipment.location}</p>

                            <div class="status-module">
                                <div class="status-title">Active Transit Pipeline Status</div>
                                <div class="status-value">${shipment.status}</div>
                            </div>

                            <div class="notes-module">
                                <div class="notes-heading">Dispatch & Package Information</div>
                                <p class="notes-body">${customMessage || shipment.notes || 'Your package is proceeding through transit.'}</p>
                            </div>
                        </div>
                        <div class="footer-section">
                            <strong>STAR EXPRESS COURIER & LOGISTICS</strong><br>
                            Global Supply Chain Management & Express Freight Networks.
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `
        });
        console.log(`Email successfully dispatched to ${recipient}`);
        return true;
    } catch (error) {
        console.error("Nodemailer Error Details (Non-blocking):", error.message);
        return false; // Safely bypasses mail errors so database saves never fail
    }
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
// Shipment & Tracking API Routes (MongoDB)
// ==========================

app.get('/api/shipments', async (req, res) => {
    try {
        const shipments = await Shipment.find({}).sort({ createdAt: -1 });
        res.json(shipments);
    } catch (error) {
        console.error('Error reading shipments:', error);
        res.status(500).json({ success: false, message: 'Unable to load shipments.' });
    }
});

app.get('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const code = req.params.trackingCode.trim().toLowerCase();
        const shipment = await Shipment.findOne({ trackingCode: code });
        
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
        const trackingCode = String(input.trackingCode || '').trim().toLowerCase();
        const currentLocation = String(input.currentLocation || input.location || input.origin || '').trim();
        
        if (!trackingCode || !input.receiverName || !input.destination) {
            return res.status(400).json({ success: false, message: 'Tracking code, receiver, and destination are required.' });
        }

        const existing = await Shipment.findOne({ trackingCode });
        if (existing) {
            return res.status(409).json({ success: false, message: 'That tracking code already exists.' });
        }

        const newShipment = new Shipment({
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
            history: [{
                status: String(input.status || 'Order Processed').trim(),
                location: currentLocation,
                note: 'Shipment registered.'
            }]
        });

        await newShipment.save();
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

        const shipment = await Shipment.findOne({ trackingCode: code });
        if (!shipment) {
            return res.status(404).json({ success: false, message: 'Shipment not found in database.' });
        }

        shipment.status = status || shipment.status;
        shipment.currentLocation = pos;
        shipment.location = pos;
        
        shipment.history.push({
            status: shipment.status,
            location: pos,
            note: customMessage || 'Status updated by logistics team.'
        });

        await shipment.save();

        let emailSent = false;
        try {
            emailSent = await sendShipmentEmail(shipment, customMessage);
        } catch (emailErr) {
            console.error("Email dispatch warning:", emailErr.message);
        }

        res.status(200).json({ ...shipment.toObject(), emailSent });
    } catch (error) {
        console.error("Error updating shipment:", error);
        res.status(500).json({ success: false, message: "Failed to update shipment." });
    }
});

app.delete('/api/shipments/:trackingCode', async (req, res) => {
    try {
        const code = req.params.trackingCode.trim().toLowerCase();
        const deleted = await Shipment.findOneAndDelete({ trackingCode: code });

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Shipment not found.' });
        }

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