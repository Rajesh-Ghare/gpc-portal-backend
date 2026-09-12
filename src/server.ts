import { createApp } from './app';
import { env } from './config/env';
import { sequelize } from './config/database';

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
  } catch (err) {
    console.error('Unable to connect to the database:', err);
  }

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start();
