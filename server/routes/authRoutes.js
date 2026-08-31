import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// @desc    Sync user auth and retrieve profile
// @route   POST /api/auth/sync
// @access  Private
router.post('/sync', protect, async (req, res) => {
  try {
    // Set user online status
    req.user.isOnline = true;
    req.user.lastSeen = new Date();

    // Ensure user has a username
    if (!req.user.username) {
      let baseUsername = req.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (baseUsername.length < 3) {
        baseUsername = "user_" + baseUsername;
      }
      let uniqueUsername = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: uniqueUsername })) {
        uniqueUsername = `${baseUsername}${counter}`;
        counter++;
      }
      req.user.username = uniqueUsername;
    }

    await req.user.save();

    res.json({
      _id: req.user._id,
      firebaseUid: req.user.firebaseUid,
      email: req.user.email,
      displayName: req.user.displayName,
      username: req.user.username,
      avatarUrl: req.user.avatarUrl,
      isOnline: req.user.isOnline,
      lastSeen: req.user.lastSeen,
    });
  } catch (error) {
    console.error(`[Sync Route Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update user profile (displayName and avatarUrl)
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { displayName, avatarUrl, username } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (displayName) user.displayName = displayName;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    if (username && username.trim()) {
      const cleanedUsername = username.toLowerCase().trim();
      if (!cleanedUsername.match(/^[a-z0-9_]{3,20}$/)) {
        return res.status(400).json({ message: 'Username must be 3-20 characters, containing only letters, numbers, and underscores' });
      }
      const existing = await User.findOne({ username: cleanedUsername, _id: { $ne: req.user._id } });
      if (existing) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      user.username = cleanedUsername;
    }

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      firebaseUid: updatedUser.firebaseUid,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      username: updatedUser.username,
      avatarUrl: updatedUser.avatarUrl,
      isOnline: updatedUser.isOnline,
      lastSeen: updatedUser.lastSeen,
    });
  } catch (error) {
    console.error(`[Profile Update Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all users list (useful for user search and DM setup)
// @route   GET /api/auth/users
// @access  Private
router.get('/users', protect, async (req, res) => {
  try {
    // Find all users except the current authenticated user
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('-firebaseUid')
      .sort({ displayName: 1 });
    res.json(users);
  } catch (error) {
    console.error(`[Get Users Error]: ${error.message}`);
  }
});

// @desc    Get a single user by their Unique ID (ObjectId or Email)
// @route   GET /api/auth/users/:query
// @access  Private
router.get('/users/:query', protect, async (req, res) => {
  try {
    const { query } = req.params;
    let user = null;

    // Check if query is a valid 24-character hex MongoDB ObjectId
    if (query.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(query).select('-firebaseUid');
    } else if (query.includes('@')) {
      // Search by email match
      user = await User.findOne({ email: query.toLowerCase().trim() }).select('-firebaseUid');
    } else {
      // Search by username match
      user = await User.findOne({ username: query.toLowerCase().trim() }).select('-firebaseUid');
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(`[Get User by Query Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get saved contacts list
// @route   GET /api/auth/contacts
// @access  Private
router.get('/contacts', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'contacts.user',
      select: 'displayName email username avatarUrl isOnline lastSeen',
    });
    res.json(user.contacts || []);
  } catch (error) {
    console.error(`[Get Contacts Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Save a contact by Unique ID or Email with a nickname
// @route   POST /api/auth/contacts
// @access  Private
router.post('/contacts', protect, async (req, res) => {
  try {
    const { queryId, nickname } = req.body;

    if (!queryId || !nickname || !nickname.trim()) {
      return res.status(400).json({ message: 'Unique ID/Email and Nickname are required' });
    }

    let contactUser = null;

    // Check if queryId is a valid 24-character hex MongoDB ObjectId
    if (queryId.match(/^[0-9a-fA-F]{24}$/)) {
      contactUser = await User.findById(queryId);
    } else if (queryId.includes('@')) {
      contactUser = await User.findOne({ email: queryId.toLowerCase().trim() });
    } else {
      contactUser = await User.findOne({ username: queryId.toLowerCase().trim() });
    }

    if (!contactUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (contactUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot save yourself as a contact' });
    }

    const user = await User.findById(req.user._id);

    // Check if contact already exists
    const contactIndex = user.contacts.findIndex(
      (c) => c.user.toString() === contactUser._id.toString()
    );

    if (contactIndex > -1) {
      // Update nickname if already exists
      user.contacts[contactIndex].nickname = nickname.trim();
    } else {
      // Add new contact
      user.contacts.push({
        user: contactUser._id,
        nickname: nickname.trim(),
      });
    }

    await user.save();

    // Populate and return updated contacts
    const updatedUser = await User.findById(req.user._id).populate({
      path: 'contacts.user',
      select: 'displayName email username avatarUrl isOnline lastSeen',
    });

    res.json(updatedUser.contacts);
  } catch (error) {
    console.error(`[Save Contact Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update a saved contact's nickname
// @route   PUT /api/auth/contacts/:contactUserId
// @access  Private
router.put('/contacts/:contactUserId', protect, async (req, res) => {
  try {
    const { contactUserId } = req.params;
    const { nickname } = req.body;

    if (!nickname || !nickname.trim()) {
      return res.status(400).json({ message: 'Nickname is required' });
    }

    const user = await User.findById(req.user._id);
    const contact = user.contacts.find((c) => c.user.toString() === contactUserId);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    contact.nickname = nickname.trim();
    await user.save();

    const updatedUser = await User.findById(req.user._id).populate({
      path: 'contacts.user',
      select: 'displayName email username avatarUrl isOnline lastSeen',
    });

    res.json(updatedUser.contacts);
  } catch (error) {
    console.error(`[Update Contact Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a saved contact
// @route   DELETE /api/auth/contacts/:contactUserId
// @access  Private
router.delete('/contacts/:contactUserId', protect, async (req, res) => {
  try {
    const { contactUserId } = req.params;

    const user = await User.findById(req.user._id);
    user.contacts = user.contacts.filter((c) => c.user.toString() !== contactUserId);
    await user.save();

    const updatedUser = await User.findById(req.user._id).populate({
      path: 'contacts.user',
      select: 'displayName email username avatarUrl isOnline lastSeen',
    });

    res.json(updatedUser.contacts);
  } catch (error) {
    console.error(`[Delete Contact Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

export default router;
