import { Sequelize } from 'sequelize';
import { env } from './env';

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.nodeEnv === 'development' ? console.log : false,
  dialectOptions: env.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  define: {
    underscored: true,
    timestamps: true,
  },
});
