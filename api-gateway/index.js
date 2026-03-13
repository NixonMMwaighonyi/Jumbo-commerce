const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io');

const app = express();

// 1. Server & WebSocket Setup
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

app.use(cors()); 
app.use(express.json());

console.log("🐘 Monolith Backend attempting to start...");

// --- MOCK DATABASE (Memory Storage) ---
const mockProducts = [
    { id: 1, name: "Wireless Noise-Cancelling Headphones", price: 299.99, category: "Electronics", image: "https://via.placeholder.com/150" },
    { id: 2, name: "Minimalist Smartwatch", price: 199.50, category: "Electronics", image: "https://via.placeholder.com/150" },
    { id: 3, name: "Ergonomic Office Chair", price: 145.00, category: "Furniture", image: "https://via.placeholder.com/150" },
    { id: 4, name: "Mechanical Keyboard", price: 85.00, category: "Electronics", image: "https://via.placeholder.com/150" }
];

const mockOrders = [];

// --- WEBSOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log('⚡ A user connected via WebSockets:', socket.id);

    socket.on('data_changed', () => {
        console.log('🔄 Data change detected! Broadcasting to all clients...');
        socket.broadcast.emit('refresh_data'); 
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });
});

// --- REST API ENDPOINTS ---

// Root / Health Check (So Render stops throwing a 404 on the main link)
app.get('/', (req, res) => {
    res.status(200).json({ message: "Jumbo Commerce API is Live!" });
});

// Auth Route
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    // For portfolio purposes, accept any login. Assign admin role if email contains 'admin'
    if (email && password) {
        res.status(200).json({ 
            token: "mock-jwt-token-777", 
            user: { email, role: email.includes('admin') ? 'admin' : 'user' } 
        });
    } else {
        res.status(400).json({ message: "Email and password required" });
    }
});

// Products Route
app.get('/api/products', (req, res) => {
    res.status(200).json(mockProducts);
});

// Orders Route
app.post('/api/orders', (req, res) => {
    const newOrder = {
        id: mockOrders.length + 1,
        items: req.body.items || [],
        total: req.body.total || 0,
        date: new Date().toISOString()
    };
    mockOrders.push(newOrder);
    
    // Tell all connected clients an order was placed
    io.emit('refresh_data'); 
    
    res.status(201).json({ message: "Order placed successfully", order: newOrder });
});

// Catch-All
app.use((req, res) => {
    res.status(404).json({ message: "Gateway Error: Route not found", path: req.path });
});

// --- START SERVER ---
// Render REQUIRES process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Monolith API is running on port ${PORT}`);
});