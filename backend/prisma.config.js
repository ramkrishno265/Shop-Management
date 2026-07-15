import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

// .env ফাইলের ডেটা লোড করার জন্য এই লাইনটি দরকার
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});