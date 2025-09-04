// app.js – auto-detects LAN IP for CORS and WebSocket
require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();

const path = require('path');
const fs   = require('fs');
const os   = require('os');

/* --------------------------- Helper: get LAN IP --------------------------- */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address; // e.g. 10.11.4.7
      }
    }
  }
  return 'localhost';
}

const myIP = getLocalIP();

/* --------------------------- HTTPS certs --------------------------- */
const keyPath  = path.resolve(__dirname, 'certificate', 'key.pem');
const certPath = path.resolve(__dirname, 'certificate', 'cert.pem');

let useHttps = fs.existsSync(keyPath) && fs.existsSync(certPath);
if (!useHttps) {
  console.warn('❗ No HTTPS certs found – server will use HTTP');
}

/* ------------------------- Fastify instance ------------------------ */
const fastify = require('fastify')({
  logger: true,
  connectionTimeout: 60000, // 60 second timeout
  keepAliveTimeout: 65000,  // Keep alive slightly longer than connection timeout
  requestTimeout: 30000,    // 30 second request timeout
  bodyLimit: 10 * 1024 * 1024, // 10MB body limit
  ...(useHttps ? {
    https: {
      key : fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    }
  } : {})
});

/* ---------------------------- plugins ------------------------------ */
const fastifyCors   = require('@fastify/cors');
const fastifyCookie = require('@fastify/cookie');          // NEW 👈
const fastifyJwt    = require('@fastify/jwt');
const fastifyStatic = require('@fastify/static');
const multipart     = require('@fastify/multipart');

fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        console.log('✅ CORS: Allowing request with no origin');
        return callback(null, true);
      }
      
      const allowedOrigins = [
        `https://${myIP}:5173`,
        `http://${myIP}:5173`,
        ...process.env.CORS_42_ORIGINS?.split(',').filter(Boolean) || [],
        'https://localhost:5173',
        'http://localhost:5173',
        'https://127.0.0.1:5173',
        'http://127.0.0.1:5173'
      ];

      console.log('🔍 CORS: Checking origin:', origin);
      console.log('🔍 CORS: Allowed origins:', allowedOrigins);
      console.log('🔍 CORS: Current IP detected as:', myIP);

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        console.log('✅ CORS: Origin allowed');
        return callback(null, true);
      }
      
      // For development, allow any origin that matches the pattern of 42beirut.com domains
      if (origin.includes('42beirut.com:5173')) {
        console.log('✅ CORS: 42beirut.com domain allowed for development');
        return callback(null, true);
      }
      
      // Firefox compatibility: allow origins ending with :5173 for development
      if (origin.endsWith(':5173')) {
        console.log('✅ CORS: Development port 5173 allowed for Firefox compatibility');
        return callback(null, true);
      }
      
      console.log('❌ CORS: Origin NOT allowed');
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },

  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200, // For legacy browser support
  preflightContinue: false,
  maxAge: 86400 // Cache preflight for 24 hours
});

/* ---- register cookie plugin *before* JWT so jwt can read cookies ---- */
fastify.register(fastifyCookie, {
  // If you ever want signed cookies, add a secret here.
  // parseOptions lets you tweak default cookie.parse behaviour.
});

/* ---------------- JWT now uses a cookie called access_token --------- */
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'forsecret',
  cookie: {
    cookieName: 'access_token',
    signed     : false          // we didn’t sign above
  }
});

fastify.register(multipart, {
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
    fieldSize: 100 * 1024 // 100KB for text fields
  }
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/'
});

/* ----------------------- Additional security headers --------------- */
fastify.addHook('onRequest', async (_request, reply) => {
  // Add security headers for Firefox compatibility
  reply.header('Strict-Transport-Security', 'max-age=0; includeSubDomains');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'SAMEORIGIN');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

/* ----------------------------- routes ------------------------------ */
fastify.register(require('./routes/avatar'));
fastify.register(require('./routes/auth'),    { prefix: '/api' });
fastify.register(require('./routes/match'));
fastify.register(require('./routes/friends'), { prefix: '/api' });

fastify.get('/', (_req, reply) => {
  reply.type('text/html').send(`<script>location.href = '#/home'</script>`);
});

// Special route for Firefox SSL certificate acceptance
fastify.get('/firefox-ssl-test', (_req, reply) => {
  reply.type('application/json').send({
    message: 'SSL connection successful',
    browser: 'firefox-compatible',
    timestamp: new Date().toISOString()
  });
});

/* ----------------------- online users set -------------------------- */
fastify.decorate('onlineUsers', new Set());

/* -------------------------- WebSockets ----------------------------- */
const { createWebSocketServer } = require('./ws');

/* ----------------------- Cleanup job ----------------------- */
const User = require('./models/user');
// Clean expired refresh tokens every hour
setInterval(async () => {
  try {
    await User.cleanupExpiredRefreshTokens();
    console.log('🧹 Cleaned up expired refresh tokens');
  } catch (err) {
    console.error('❌ Cleanup error:', err);
  }
}, 60 * 60 * 1000); // 1 hour

/* --------------------------- start-up ------------------------------ */
(async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });

    const protocol = useHttps ? 'https' : 'http';
    console.log(`🚀 Server ready at ${protocol}://${myIP}:${port}`);
    console.log(`🔐 CORS allows: ${protocol}://${myIP}:5173`);
    console.log(`🛰️  WebSocket:  ${protocol === 'https' ? 'wss' : 'ws'}://${myIP}:${port}/`);

    createWebSocketServer(fastify.server);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
})();
