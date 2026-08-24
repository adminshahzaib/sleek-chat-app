import express from 'express';
import { protect } from '../middleware/auth.js';
import Room from '../models/Room.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

const router = express.Router();

// @desc    Get all public rooms and private rooms current user is a member of
// @route   GET /api/rooms
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [
        { isPrivate: false },
        { members: req.user._id }
      ]
    })
      .populate('members', 'displayName email avatarUrl username isOnline lastSeen')
      .populate('createdBy', 'displayName email avatarUrl username')
      .populate({
        path: 'joinRequests',
        select: 'displayName email username avatarUrl'
      })
      .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (error) {
    console.error(`[Get Rooms Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a new room (public or private)
// @route   POST /api/rooms
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, isPrivate, members } = req.body;

    if (!name) {
      return res.status(404).json({ message: 'Room name is required' });
    }

    // Auto-include creator in members list
    const roomMembers = Array.isArray(members) ? [...members] : [];
    if (!roomMembers.includes(req.user._id.toString())) {
      roomMembers.push(req.user._id);
    }

    const room = await Room.create({
      name,
      description: description || '',
      isPrivate: !!isPrivate,
      members: roomMembers,
      createdBy: req.user._id,
    });

    // Create channel creation message for non-DM rooms
    if (name !== 'DM') {
      await Message.create({
        roomId: room._id,
        senderId: req.user._id,
        content: `Channel created by ${req.user.displayName}`,
        isSystem: true,
      });
    }

    const populatedRoom = await Room.findById(room._id)
      .populate('members', 'displayName email avatarUrl username isOnline lastSeen')
      .populate('createdBy', 'displayName email avatarUrl username')
      .populate({
        path: 'joinRequests',
        select: 'displayName email username avatarUrl'
      });

    // Notify all participants in real-time
    const io = req.app.get('io');
    if (io) {
      populatedRoom.members.forEach((member) => {
        io.to(`user_${member._id.toString()}`).emit('room_created_or_updated', populatedRoom);
      });
    }

    res.status(201).json(populatedRoom);
  } catch (error) {
    console.error(`[Create Room Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get details of a single room by ID (for joining/requesting purposes)
// @route   GET /api/rooms/:roomId
// @access  Private
router.get('/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid Channel ID format' });
    }

    const room = await Room.findById(roomId)
      .populate('members', 'displayName email avatarUrl username isOnline lastSeen')
      .populate('createdBy', 'displayName email avatarUrl username')
      .populate({
        path: 'joinRequests',
        select: 'displayName email username avatarUrl'
      });

    if (!room) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    res.json(room);
  } catch (error) {
    console.error(`[Get Room Details Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Submit a request to join a room
// @route   POST /api/rooms/:roomId/requests
// @access  Private
router.post('/:roomId/requests', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    if (room.members.includes(req.user._id.toString())) {
      return res.status(400).json({ message: 'You are already a member of this channel' });
    }

    if (!room.joinRequests) {
      room.joinRequests = [];
    }

    if (room.joinRequests.includes(req.user._id)) {
      return res.status(400).json({ message: 'You have already submitted a join request for this channel' });
    }

    room.joinRequests.push(req.user._id);
    await room.save();

    const populatedRoom = await Room.findById(roomId)
      .populate('members', 'displayName email avatarUrl username isOnline lastSeen')
      .populate('createdBy', 'displayName email avatarUrl username')
      .populate({
        path: 'joinRequests',
        select: 'displayName email username avatarUrl'
      });

    // Notify admin in real-time if online
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${room.createdBy.toString()}`).emit('room_created_or_updated', populatedRoom);
    }

    res.json({ message: 'Join request submitted successfully', room: populatedRoom });
  } catch (error) {
    console.error(`[Submit Request Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Accept or reject a user's join request
// @route   POST /api/rooms/:roomId/requests/:userId/respond
// @access  Private
router.post('/:roomId/requests/:userId/respond', protect, async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Only room creator/admin can process requests
    if (room.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the channel admin can process join requests' });
    }

    if (!room.joinRequests || !room.joinRequests.includes(userId)) {
      return res.status(400).json({ message: 'No active join request found for this user' });
    }

    // Remove user from joinRequests list
    room.joinRequests = room.joinRequests.filter(id => id.toString() !== userId);

    if (action === 'accept') {
      // Add user to members list if not already there
      if (!room.members.includes(userId)) {
        room.members.push(userId);
      }
      await room.save();

      // Fetch details of added user
      const addedUser = await User.findById(userId);
      
      // Create system log message
      if (addedUser) {
        await Message.create({
          roomId,
          senderId: req.user._id,
          content: `${addedUser.username ? `@${addedUser.username}` : addedUser.displayName} was accepted into the channel`,
          isSystem: true,
        });
      }

      const populatedRoom = await Room.findById(roomId)
        .populate('members', 'displayName email avatarUrl username isOnline lastSeen')
        .populate('createdBy', 'displayName email avatarUrl username')
        .populate({
          path: 'joinRequests',
          select: 'displayName email username avatarUrl'
        });

      // Notify all participants (old and new) in real-time
      const io = req.app.get('io');
      if (io) {
        populatedRoom.members.forEach((member) => {
          io.to(`user_${member._id.toString()}`).emit('room_created_or_updated', populatedRoom);
        });

        // Emit system message to room socket
        const systemMsg = await Message.findOne({ roomId, isSystem: true }).sort({ createdAt: -1 })
          .populate('senderId', 'displayName email avatarUrl');
        if (systemMsg) {
          io.to(roomId).emit('receive_message', systemMsg);
        }
      }
      return res.json(populatedRoom);
    } else {
      // Action is reject, just save with removed request
      await room.save();
      
      const populatedRoom = await Room.findById(roomId)
        .populate('members', 'displayName email avatarUrl username isOnline lastSeen')
        .populate('createdBy', 'displayName email avatarUrl username')
        .populate({
          path: 'joinRequests',
          select: 'displayName email username avatarUrl'
        });

      // Notify admin of updated room state
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${req.user._id.toString()}`).emit('room_created_or_updated', populatedRoom);
      }

      return res.json(populatedRoom);
    }
  } catch (error) {
    console.error(`[Respond Request Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get messages for a specific room (paginated)
// @route   GET /api/rooms/:roomId/messages
// @access  Private
router.get('/:roomId/messages', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // ISO date string for cursor pagination

    // Verify room access
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.members.includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to view messages in this channel. You must join the channel first.' });
    }

    const query = { roomId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Retrieve messages sorted newest first, up to the limit, then reverse to chronological
    const messages = await Message.find(query)
      .populate('senderId', 'displayName username email avatarUrl')
      .populate({
        path: 'replyTo',
        select: 'content isDeleted senderId',
        populate: { path: 'senderId', select: 'displayName username' },
      })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(messages.reverse());
  } catch (error) {
    console.error(`[Get Messages Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Add members to a group room
// @route   PUT /api/rooms/:roomId/members
// @access  Private
router.put('/:roomId/members', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { members } = req.body; // array of user IDs

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: 'Members list must be a non-empty array' });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Verify requesting user is currently a member
    if (!room.members.includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Only current members can invite others' });
    }

    // Push new members ensuring no duplicates
    const newMemberIds = [];
    members.forEach((memberId) => {
      if (!room.members.includes(memberId)) {
        room.members.push(memberId);
        newMemberIds.push(memberId);
      }
    });

    await room.save();

    const populatedRoom = await Room.findById(roomId)
      .populate('members', 'displayName email avatarUrl isOnline lastSeen')
      .populate('createdBy', 'displayName email avatarUrl');

    // Notify all participants (old and new) in real-time
    const io = req.app.get('io');
    if (io) {
      populatedRoom.members.forEach((member) => {
        io.to(`user_${member._id.toString()}`).emit('room_created_or_updated', populatedRoom);
      });

      // Create and broadcast system message notifications for each added member
      for (const memberId of newMemberIds) {
        const addedUser = await User.findById(memberId);
        if (addedUser) {
          const systemMsg = await Message.create({
            roomId,
            senderId: req.user._id,
            content: `${req.user.displayName} added ${addedUser.username ? `@${addedUser.username}` : addedUser.displayName}`,
            isSystem: true,
          });

          const populatedMsg = await Message.findById(systemMsg._id)
            .populate('senderId', 'displayName email avatarUrl');

          io.to(roomId).emit('receive_message', populatedMsg);
        }
      }
    }

    res.json(populatedRoom);
  } catch (error) {
    console.error(`[Add Members Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Remove a member from a group room
// @route   DELETE /api/rooms/:roomId/members/:userId
// @access  Private
router.delete('/:roomId/members/:userId', protect, async (req, res) => {
  try {
    const { roomId, userId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Only room creator/admin can remove members
    if (room.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the channel admin can remove members' });
    }

    // Cannot remove yourself
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot remove yourself. Delete the group instead.' });
    }

    // Remove member from array
    room.members = room.members.filter((id) => id.toString() !== userId);
    await room.save();

    // Create system message notification
    const removedUser = await User.findById(userId);
    if (removedUser) {
      await Message.create({
        roomId,
        senderId: req.user._id,
        content: `${req.user.displayName} removed ${removedUser.username ? `@${removedUser.username}` : removedUser.displayName}`,
        isSystem: true,
      });
    }

    const populatedRoom = await Room.findById(roomId)
      .populate('members', 'displayName email avatarUrl isOnline lastSeen')
      .populate('createdBy', 'displayName email avatarUrl');

    // Notify all participants in real-time
    const io = req.app.get('io');
    if (io) {
      // Notify remaining members of update
      populatedRoom.members.forEach((member) => {
        io.to(`user_${member._id.toString()}`).emit('room_created_or_updated', populatedRoom);
      });
      // Emit room_removed to the kicked member
      io.to(`user_${userId}`).emit('room_removed', { roomId });

      // Emit system message to room socket
      const systemMsg = await Message.findOne({ roomId, isSystem: true }).sort({ createdAt: -1 })
        .populate('senderId', 'displayName email avatarUrl');
      if (systemMsg) {
        io.to(roomId).emit('receive_message', systemMsg);
      }
    }

    res.json(populatedRoom);
  } catch (error) {
    console.error(`[Remove Member Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a group room completely
// @route   DELETE /api/rooms/:roomId
// @access  Private
router.delete('/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Only room creator/admin can delete the group
    if (room.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the channel admin can delete this group' });
    }

    // Cannot delete DM rooms
    if (room.name === 'DM') {
      return res.status(400).json({ message: 'Direct Message rooms cannot be deleted' });
    }

    const membersToNotify = [...room.members];

    // Delete all messages in the room
    await Message.deleteMany({ roomId });
    
    // Delete the room
    await Room.findByIdAndDelete(roomId);

    // Notify all members via socket
    const io = req.app.get('io');
    if (io) {
      membersToNotify.forEach((memberId) => {
        io.to(`user_${memberId.toString()}`).emit('room_removed', { roomId });
      });
    }

    res.json({ message: 'Group deleted successfully', roomId });
  } catch (error) {
    console.error(`[Delete Group Error]: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

export default router;
