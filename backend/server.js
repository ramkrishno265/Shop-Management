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
import AddCustomer from './routes/customer.routes.js';
import shopRoutes from './routes/shopProfileRouter.js';
import FieldRouter from './routes/FieldRouter.js';
import CustomerPaymentRoutes from './routes/CustomerPaymentRouter.js';
import ReturnRouter from './routes/ReturnRouter.js';

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
app.use('/api/add_customer', AddCustomer);
app.use('/api/shops_profile', shopRoutes);
app.use('/api/fields', FieldRouter);
app.use('/api', CustomerPaymentRoutes); // Customer Payment Collection & History Routes
app.use('/api/returns', ReturnRouter); 
// Test Base Route
app.get('/', (req, res) => {
  res.send('Shop Management System Clean API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is cruising cleanly on port ${PORT}`);
});