import authRoutes from './routes/auth.routes.js';
import accountRoutes from './routes/account.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import adminRoutes from './routes/admin.routes.js';
import exportRoutes from './routes/export.routes.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ApiError } from './utils/ApiError.js';

const app = express();

// --- Security Middleware ---
// helmet sets secure HTTP headers (prevents XSS, clickjacking, etc.)
app.use(helmet());

// cors must be configured explicitly — never use wildcard (*) in production
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));



// --- Request Parsing ---
app.use(express.json({ limit: '16kb' })); // prevents payload attacks
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// --- Logging (dev only) ---
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// --- Routes (added in later steps) ---
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Global Error Handler ---
// Must be last middleware. Express identifies error handlers by 4 params.
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || [],
    // Never expose stack trace in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;