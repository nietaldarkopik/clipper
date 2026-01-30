import IORedis from 'ioredis';

// Lazy connection to avoid crashing when not using Redis
let connection: IORedis | null = null;

export const getRedisConnection = () => {
  if (!connection) {
    connection = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      lazyConnect: true, // Don't connect immediately
    });
    
    // Only connect if we actually need it, but lazyConnect: true handles the initial connect.
    // However, if we perform commands, it will try to connect.
    
    connection.on('error', (err) => {
        // Suppress errors if we are in mock mode? 
        // Or just log them.
        console.error('[Redis] Connection error:', err.message);
    });
  }
  return connection;
};

export default getRedisConnection;
