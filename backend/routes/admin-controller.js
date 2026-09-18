const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Configure your email transporter (e.g., Gmail, SendGrid, or SMTP provider)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com', // Replace with your email
        pass: 'your-email-app-password' // Replace with your email app password
    }
});

// Admin Update Shipment & Send Notification Endpoint
router.post('/api/admin/update-shipment', async (req, res) => {
    try {
        const { trackingCode, newStatus, newLocation, customMessage, userEmail } = req.body;

        // 1. TODO: Update your database with the new status and location here
        // await db.query('UPDATE shipments SET status = ?, location = ? WHERE tracking_code = ?', [newStatus, newLocation, trackingCode]);

        // 2. Send the notification email to the user with the admin's custom message
        const mailOptions = {
            from: '"Star Express Support" <support@starexpress.com>',
            to: userEmail, // The recipient user's email address
            subject: `Update on your Star Express Package (${trackingCode})`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #e63946;">Star Express Shipment Update</h2>
                    <p><strong>Tracking Number:</strong> ${trackingCode}</p>
                    <p><strong>Current Status:</strong> ${newStatus}</p>
                    <p><strong>Current Location:</strong> ${newLocation}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p><strong>Message from Logistics Team:</strong></p>
                    <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #e63946; margin: 0;">
                        ${customMessage}
                    </blockquote>
                    <p style="margin-top: 20px; font-size: 0.9em; color: #777;">Thank you for choosing Star Express.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            success: true, 
            message: "Shipment updated successfully and email notification sent to the user!" 
        });

    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ success: false, message: "Failed to update shipment or send email." });
    }
});

module.exports = router;