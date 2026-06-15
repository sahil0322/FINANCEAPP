import 'dotenv/config';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { env } from './src/config/env.js';

const PORT = env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
  });
}).catch((err) => {
  console.error('DB connection failed. Server not started.', err);
  process.exit(1);
});