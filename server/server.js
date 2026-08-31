import express from 'express';
import dns from 'dns';

// Force IPv4 lookup globally across the Node process
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import { socketAuth } from './socket/socketAuth.js';
import registerSocketHandlers from './socket/socketHandler.js';
import { verifyTransporter } from './services/emailService.js';

// Connect to database and verify email transporter
connectDB();
verifyTransporter();

const app = express();
const server = http.createServer(app);

// Reverse Proxy configuration for Render / Vercel
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// CORS setup
let clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = [
  clientUrl,
  clientUrl.endsWith('/') ? clientUrl.slice(0, -1) : clientUrl + '/'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    const normalizedClientUrl = clientUrl.replace(/\/$/, '');
    if (normalizedOrigin === normalizedClientUrl || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked]: Request from origin ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Body parsers with payload limit protection
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Root path test route
app.get('/', (req, res) => {
  res.send('Chat App API is running... (v2)');
});

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// Socket Authentication Middleware
io.use(socketAuth);

// Socket Event Handlers
registerSocketHandlers(io);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[Server] running in development mode on port ${PORT}`);
});
