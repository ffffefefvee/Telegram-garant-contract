import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'garant_user',
  password: process.env.DB_PASSWORD || 'garant_pass',
  database: process.env.DB_NAME || 'garant_db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
};

export const getDatabaseConfig = (): TypeOrmModuleOptions => ({
  ...databaseConfig,
});
