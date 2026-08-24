import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import { socketAuth } from './socket/socketAuth.js';
import registerSocketHandlers from './socket/socketHandler.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// CORS setup
let clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
if (clientUrl.endsWith('/')) {
  clientUrl = clientUrl.slice(0, -1);
}

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Root path test route
app.get('/', (req, res) => {
  res.send('Chat App API is running...');
});

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: clientUrl,
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
