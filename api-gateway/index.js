const express = require('express');

const cors = require('cors');

const proxy = require('express-http-proxy');

const http = require('http'); // NEW: Required for WebSockets

const { Server } = require('socket.io'); // NEW: Import Socket.io



const app = express();



// Create the HTTP server and attach Socket.io

const server = http.createServer(app);

const io = new Server(server, {

    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }

});



// 1. Allow Frontend to talk to Gateway

app.use(cors());

app.use(express.json());



console.log("🐘 Gateway attempting to start...");



// --- WEBSOCKET LOGIC ---

io.on('connection', (socket) => {

    console.log('⚡ A user connected via WebSockets:', socket.id);



    // When ANY connected user triggers an update (like buying a product)

    socket.on('data_changed', () => {

        console.log('🔄 Data change detected! Broadcasting to all clients...');

        // Tell EVERYONE ELSE to refresh their data

        socket.broadcast.emit('refresh_data');

    });



    socket.on('disconnect', () => {

        console.log('❌ User disconnected:', socket.id);

    });

});

// -----------------------



// 2. Auth Service

app.use('/', proxy('http://auth-service:3001', {

    filter: (req) => req.path.startsWith('/auth')

}));



// 3. Product Service

app.use('/', proxy('http://product-service:3002', {

    filter: (req) => req.path.startsWith('/products')

}));



// 4. Order Service

app.use('/', proxy('http://order-service:3003', {

    filter: (req) => req.path.startsWith('/orders')

}));



// 5. "Catch-All" for Lost Requests

app.use((req, res) => {

    res.status(404).json({

        message: "Gateway Error: Route not found",

        path: req.path

    });

});



// CHANGE: Use server.listen instead of app.listen

server.listen(3000, () => {

    console.log('🚀 Gateway (HTTP + WebSockets) is running on port 3000');

});