import { Sequelize } from 'sequelize';
import { buildDbSslOptions } from './dbSsl';
import { env } from './env';

if (env.db.ssl && env.db.sslAllowUnverified) {
  console.warn(
    '[database] DB_SSL_ALLOW_UNVERIFIED=true: the connection is encrypted but the database certificate is NOT ' +
      "verified. Set DB_SSL_CA_PATH to your provider's CA bundle (or rely on a public CA) and remove this flag.",
  );
}

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.nodeEnv === 'development' ? console.log : false,
  dialectOptions: buildDbSslOptions({
    enabled: env.db.ssl,
    caPath: env.db.sslCaPath,
    allowUnverified: env.db.sslAllowUnverified,
  }),
  define: {
    underscored: true,
    timestamps: true,
  },
});
