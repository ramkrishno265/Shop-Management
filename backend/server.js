import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import productRoutes from "./routes/productRoutes.js"; // (.js এক্সটেনশনসহ import ব্যবহার করা হয়েছে)
import categoriesRouters from "./routes/categoryRouter.js";
import salesRouter from './routes/salesRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import profitRoutes from "./routes/profitRoutes.js";

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
app.use('/api', purchaseRoutes);
app.use('/api', expenseRoutes);
app.use("/api/profit", profitRoutes);


// Test Base Route
app.get('/', (req, res) => {
  res.send('Shop Management System Clean API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is cruising cleanly on port ${PORT}`);
});