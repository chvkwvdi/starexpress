const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');

// Correct path pointing to shipments.json in the backend folder
const DATA_FILE = path.join(__dirname, '../shipments.json');

// Configure your email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-email-app-password'
    }
});

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
        if (error.code === 'ENOENT') {
            await fs.writeFile(DATA_FILE, '[]', 'utf8');
            return [];
        }
        throw error;
    }
}

async function writeShipments(shipments) {
    await fs.writeFile(DATA_FILE, JSON.stringify(shipments, null, 2), 'utf8');
}

// 1. GET: Fetch all shipments
router.get('/shipments', async (req, res) => {
    try {
        const shipments = await readShipments();
        res.json(shipments);
    } catch (error) {
        console.error('Error reading shipments:', error);
        res.status(500).json({ success: false, message: 'Unable to load shipments.' });
    }
});

// 2. GET: Fetch single shipment by tracking code
router.get('/shipments/:trackingCode', async (req, res) => {
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

// 3. POST: Create a new shipment
router.post('/shipments', async (req, res) => {
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

// 4. PATCH: Update shipment status & send email notification
router.patch('/shipments/:trackingCode', async (req, res) => {
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

        // Send email notification if SMTP is configured and user email exists
        let emailSent = false;
        if ((current.userEmail || current.receiverEmail) && process.env.SMTP_HOST) {
            const recipientEmail = current.userEmail || current.receiverEmail;
            try {
                await transporter.sendMail({
                    from: process.env.MAIL_FROM || process.env.SMTP_USER,
                    to: recipientEmail,
                    subject: `Shipment update: ${current.trackingCode} is ${current.status}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #e63946;">Star Express Shipment Update</h2>
                            <p><strong>Tracking Number:</strong> ${current.trackingCode}</p>
                            <p><strong>Current Status:</strong> ${current.status}</p>
                            <p><strong>Current Location:</strong> ${pos}</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p><strong>Message from Logistics Team:</strong></p>
                            <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #e63946; margin: 0;">
                                ${customMessage || 'Your shipment information has been updated.'}
                            </blockquote>
                            <p style="margin-top: 20px; font-size: 0.9em; color: #777;">Thank you for choosing Star Express.</p>
                        </div>
                    `
                });
                emailSent = true;
            } catch (emailErr) {
                console.error("Email dispatch warning:", emailErr.message);
            }
        }

        res.status(200).json({ ...current, emailSent });
    } catch (error) {
        console.error("Error updating shipment:", error);
        res.status(500).json({ success: false, message: "Failed to update shipment." });
    }
});

// 5. DELETE: Remove shipment
router.delete('/shipments/:trackingCode', async (req, res) => {
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

module.exports = router;