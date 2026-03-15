const express = require('express');

const cors = require('cors');

const proxy = require('express-http-proxy');

const http = require('http'); // NEW: Required for WebSockets

const { Server } = require('socket.io'); // NEW: Import Socket.io



const app = express();





const server = http.createServer(app);

const io = new Server(server, {

    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }

});





app.use(cors());

app.use(express.json());



console.log("🐘 Gateway attempting to start...");





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

// -----------------------





app.use('/', proxy(process.env.AUTH_SERVICE_URL || 'http://auth-service:3001', {

    filter: (req) => req.path.startsWith('/auth')

}));





app.use('/', proxy(process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002', {

    filter: (req) => req.path.startsWith('/products')

}));





app.use('/', proxy(process.env.ORDER_SERVICE_URL || 'http://order-service:3003', {

    filter: (req) => req.path.startsWith('/orders')

}));





app.use((req, res) => {

    res.status(404).json({

        message: "Gateway Error: Route not found",

        path: req.path

    });

});





server.listen(process.env.PORT || 3000, () => {

    console.log('🚀 Gateway (HTTP + WebSockets) is running on port 3000');

});