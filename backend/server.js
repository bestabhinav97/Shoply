import app from './app.js';
import { env } from './config/env.js';
import { connectDB, pool } from './db/db.js';

try {
  await connectDB();
  const server = app.listen(env.port, '127.0.0.1', () => {
    console.log(`API running at http://localhost:${env.port}`);
  });

  server.on('error', async (error) => {
    console.error('Server failed:', error.message);
    await pool.end();
    process.exit(1);
  });

  function shutdown() {
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error('Startup failed:', error.message);
  await pool.end();
  process.exit(1);
}
