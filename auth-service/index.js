const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // The Security Engine
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 1. Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const initDB = async () => {
    // 1. Create the table with the new 'role' column included
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role VARCHAR(50) DEFAULT 'user'
        );
    `);
    
    // 2. Sneaky Auto-Update: If the table already existed from before, 
    // this line forces the new 'role' column into it automatically.
    try {
        await pool.query(`ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';`);
        console.log("✅ Upgraded existing DB: Added 'role' column.");
    } catch (err) {
        // If it throws an error, it just means the column is already there. We can ignore it!
    }
    
    console.log("✅ Auth Database Ready");
};
initDB();

// 2. REGISTER ROUTE (With Secret Backdoor)
app.post('/auth/register', async (req, res) => {
    try {
        // WE ADDED THE SECRET VAR HERE
        const { email, password, adminSecret } = req.body;

        // THE SECRET DOOR: Only becomes 'admin' if the secret passcode matches
        const userRole = (adminSecret === 'JUMBO_MASTER_2026') ? 'admin' : 'user'; 

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // WE UPDATE THE INSERT QUERY TO INCLUDE THE ROLE
        const result = await pool.query(
            'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
            [email, hashedPassword, userRole]
        );

        const newUser = result.rows[0];
        const token = jwt.sign({ user_id: newUser.id, email: newUser.email, role: newUser.role }, process.env.JWT_SECRET);
        
        console.log(`✅ New Account Created: ${newUser.email} as a ${newUser.role}`);
        
        // Send the token AND the role to the frontend
        res.status(201).json({ token: token, role: newUser.role });
    } catch (err) {
        if (err.code === '23505') {
            res.status(400).json({ message: "Email already exists" });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// 3. LOGIN ROUTE 
app.post('/auth/login', async (req, res) => {
    console.log("🚨 LOGIN ROUTE WAS JUST CLICKED 🚨"); 

    try {
        const { email, password } = req.body;

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log("❌ Failed: User not found in DB");
            return res.status(400).json({ message: "Invalid Credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            console.log("❌ Failed: Password did not match the hash");
            return res.status(400).json({ message: "Invalid Credentials" });
        }

        console.log("✅ Success! The DB is storing this hash:", user.password);
        console.log("👑 User Role is:", user.role);
        
        const token = jwt.sign({ user_id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET);
        
        // Send the token AND the role to the frontend
        res.json({ token: token, role: user.role });
    } catch (err) {
        console.error("🔥 Server Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 4. NEW: PASSWORD CHANGE ROUTE
// We map both paths just in case your API gateway routes it differently
app.put(['/users/password', '/auth/password'], async (req, res) => {
    try {
        // Step A: Make sure they are actually logged in (Check the JWT Token)
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Format is "Bearer <token>"
        
        if (!token) return res.status(401).json({ message: "Access Denied: No Token" });

        // Step B: Decode token to find out WHICH user is trying to change their password
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { password } = req.body;

        // Step C: Scramble the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Step D: Update ONLY that user's password in the database
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, decoded.user_id]);
        
        console.log(`🔐 Password updated successfully for User ID: ${decoded.user_id}`);
        res.json({ message: "Password updated successfully" });

    } catch (err) {
        console.error("🔥 Password Update Error:", err.message);
        res.status(500).json({ error: "Failed to update password" });
    }
});

app.listen(3001, () => console.log("🐘 THE BCRYPT SERVER IS ALIVE ON PORT 3001 🐘"));