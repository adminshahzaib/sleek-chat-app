import admin from '../config/firebaseAdmin.js';
import User from '../models/User.js';

export const socketAuth = async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  try {
    // Verify token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture } = decodedToken;

    // Find or provision user in MongoDB
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email: email || '',
        displayName: name || email?.split('@')[0] || 'New User',
        avatarUrl: picture || '',
        isOnline: true,
        lastSeen: new Date(),
      });
      console.log(`[Socket Auth] Auto-provisioned user: ${user.displayName} (${user._id})`);
    }

    // Attach MongoDB user object to socket object for handlers
    socket.user = user;
    next();
  } catch (error) {
    console.error(`[Socket Auth] Token verification failed: ${error.message}`);
    next(new Error('Authentication error: Invalid or expired token'));
  }
};
