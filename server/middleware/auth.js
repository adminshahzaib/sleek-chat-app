import admin from '../config/firebaseAdmin.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }

  try {
    // Verify Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture } = decodedToken;

    // Retrieve or auto-provision the MongoDB User
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      // Generate unique username
      let baseUsername = (email || name || 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (baseUsername.length < 3) {
        baseUsername = "user_" + baseUsername;
      }
      let uniqueUsername = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: uniqueUsername })) {
        uniqueUsername = `${baseUsername}${counter}`;
        counter++;
      }

      user = await User.create({
        firebaseUid: uid,
        email: email || '',
        displayName: name || email?.split('@')[0] || 'New User',
        username: uniqueUsername,
        avatarUrl: picture || '',
        isOnline: true,
        lastSeen: new Date(),
      });
      console.log(`[Auth Middleware] Auto-provisioned user: ${user.email} (${user._id})`);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(`[Auth Middleware] Token verification failed: ${error.message}`);
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
};
