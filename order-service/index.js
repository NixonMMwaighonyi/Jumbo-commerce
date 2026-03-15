const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // NEW: Added Nodemailer

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- EMAIL SETUP ---
// Replace with your actual Gmail and the 16-character App Password
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com', 
        pass: process.env.EMAIL_PASS || 'your-app-password'     
    }
});

const initDB = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT,
            price DECIMAL(10, 2),
            quantity INTEGER DEFAULT 1,
            status VARCHAR(50) DEFAULT 'Processing',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            delivered_at TIMESTAMP
        );
    `);
    
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Processing';`); } catch(err) {}
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name TEXT;`); } catch(err) {}
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);`); } catch(err) {}
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`); } catch(err) {}
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`); } catch(err) {}
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;`); } catch(err) {}
    
    console.log("✅ Orders Table Ready with New Timestamp Columns");
};
initDB();

const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json("Access Denied");
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) { res.status(400).json("Invalid Token"); }
};

// 1. CREATE ORDER (Upgraded with WebSockets & Emails)
app.post('/orders', authenticate, async (req, res) => {
    try {
        const { items } = req.body; 
        const userId = req.user.user_id || req.user.userId || req.user.id;
        const userEmail = req.user.email; // Extracted from JWT
        const token = req.headers['authorization']; 

        const insertedOrders = [];
        let orderTotal = 0;
        let receiptItemsHTML = '';

        for (let item of items) {
            // Added RETURNING * so we can send the data to the API Gateway
            const newOrder = await pool.query(
                `INSERT INTO orders (user_id, product_id, product_name, price, quantity, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
                [userId, item.product_id, item.product_name || 'Unknown Product', item.price || 0, item.quantity]
            );
            
            insertedOrders.push(newOrder.rows[0]);

            // Calculate totals for the email receipt
            const itemTotal = (item.price || 0) * item.quantity;
            orderTotal += itemTotal;
            receiptItemsHTML += `<li>${item.quantity}x ${item.product_name || 'Product'} - $${itemTotal.toFixed(2)}</li>`;
            
            // Decrement Stock in Product Service
            try {
                await fetch(`${process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002'}/products/${item.product_id}/decrement`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({ quantity: item.quantity })
                });
            } catch(e) { console.error("Could not reach Product Service to decrement stock:", e.message); }
        }

        // 🚨 Ping the API Gateway for live WebSocket alerts!
        try {
            await fetch(`${process.env.API_GATEWAY_URL || 'http://api-gateway:3000'}/internal/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'new_order_alert', data: insertedOrders })
            });
        } catch (webhookErr) {
            console.error("Could not reach API Gateway for live notification:", webhookErr.message);
        }

        // ✉️ Send the Email Receipt
        if (userEmail) {
            const mailOptions = {
                from: '"Jumbo Commerce" <noreply@jumbo.com>',
                to: userEmail,
                subject: 'Your Jumbo Commerce Receipt',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
                            <h1 style="margin: 0;">Jumbo Commerce</h1>
                            <p style="margin: 5px 0 0 0; opacity: 0.9;">Spend less. Save more.</p>
                        </div>
                        <div style="padding: 30px;">
                            <h2>Thank you for your order!</h2>
                            <p>We are currently processing your items. Here is your receipt:</p>
                            <ul style="background: #f9fafb; padding: 20px 40px; border-radius: 8px; font-size: 16px;">
                                ${receiptItemsHTML}
                            </ul>
                            <h3 style="text-align: right; color: #1f2937;">Total: $${orderTotal.toFixed(2)}</h3>
                        </div>
                    </div>
                `
            };

            // Fire and forget the email so the user isn't stuck waiting for the SMTP server
            transporter.sendMail(mailOptions).catch(err => console.error("Email failed to send:", err));
        }

        res.json({ message: "Checkout Complete!" });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// 2. FETCH ORDERS
app.get('/orders', authenticate, async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId || req.user.id;
        let result;
        if (req.query.all === 'true') {
            result = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
        } else {
            result = await pool.query("SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
        }
        res.json(result.rows);
    } catch (err) { res.status(500).send("Server Error"); }
});

// 3. UPDATE ORDER STATUS
app.put('/orders/:id', authenticate, async (req, res) => {
    try {
        const { status } = req.body;
        let query = "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *";
        
        if (status === 'Delivered') {
            query = "UPDATE orders SET status = $1, updated_at = NOW(), delivered_at = NOW() WHERE id = $2 RETURNING *";
        }
        
        const updatedOrder = await pool.query(query, [status, req.params.id]);
        res.json(updatedOrder.rows[0]);
    } catch (err) { res.status(500).send("Server Error"); }
});

// 4. DELETE ORDER
app.delete('/orders/:id', authenticate, async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        for (let id of ids) {
            await pool.query("DELETE FROM orders WHERE id = $1", [id]);
        }
        res.json({ message: "Order(s) deleted." });
    } catch (err) { res.status(500).send("Server Error"); }
});

app.listen(process.env.PORT || 3003, () => console.log("🛒 Order Service running on port 3003"));