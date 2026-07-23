import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import productRoutes from "./routes/productRoutes.js"; // (.js এক্সটেনশনসহ import ব্যবহার করা হয়েছে)
import categoriesRouters from "./routes/categoryRouter.js";
import salesRouter from './routes/salesRoutes.js';
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes Middleware
app.use('/api/auth', authRoutes);
app.use("/api/products", productRoutes); 
app.use("/api/categories",categoriesRouters);
app.use('/api/sales', salesRouter);


// Test Base Route
app.get('/', (req, res) => {
  res.send('Shop Management System Clean API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is cruising cleanly on port ${PORT}`);
});