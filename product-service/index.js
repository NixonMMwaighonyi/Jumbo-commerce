const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// 1. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("Could not connect to MongoDB", err));

// 2. Upgraded Schema (Added Validations)
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // Validation added
    stock: { type: Number, required: true, default: 10, min: 0 }, // Validation added
    image: { type: String, default: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80' },
    category: { type: String, default: 'General' },
    reviews: [{
        rating: { type: Number, required: true, min: 1, max: 5 }, // Validation added
        comment: String,
        user_id: String,
        date: { type: Date, default: Date.now }
    }]
});

const Product = mongoose.model('Product', productSchema);

// 3. Middlewares
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Access Denied" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid Token" });
        req.user = user;
        next();
    });
};

// NEW: RBAC Middleware
const isAdmin = (req, res, next) => {
    if (!req.user || req.user.email !== 'admin@jumbo.com') {
        return res.status(403).json({ message: "Forbidden: Admins Only" });
    }
    next();
};

// 4. Routes
app.get('/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

// CREATE (Protected by isAdmin)
app.post('/products', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (req.body.price < 0 || req.body.stock < 0) return res.status(400).json({ message: "No negative values" });
        const product = new Product(req.body);
        const savedProduct = await product.save();
        res.status(201).json(savedProduct);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// UPDATE (Protected by isAdmin)
app.put('/products/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (req.body.price < 0 || req.body.stock < 0) return res.status(400).json({ message: "No negative values" });
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, req.body, { new: true }
        );
        res.json(updatedProduct);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/products/:id/reviews', authenticateToken, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const product = await Product.findById(req.params.id);
        
        if (!product) return res.status(404).json({ message: "Product not found" });
        if (rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1-5" });

        const userId = req.user.user_id || req.user.userId || req.user.id;
        product.reviews.push({ rating, comment, user_id: userId });
        
        await product.save();
        res.json(product);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/products/:id/decrement', authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        const product = await Product.findById(req.params.id);
        
        if (!product || product.stock < quantity) {
            return res.status(400).json({ message: "Not enough stock!" });
        }
        
        product.stock -= quantity;
        await product.save();
        res.json(product);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (Protected by isAdmin)
app.delete('/products/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(process.env.PORT || 3002, () => console.log("Product Service running on port 3002"));