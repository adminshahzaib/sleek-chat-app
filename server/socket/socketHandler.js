import User from '../models/User.js';
import Room from '../models/Room.js';
import Message from '../models/Message.js';
import registerCallHandlers from './callHandler.js';

export default function registerSocketHandlers(io) {
  io.on('connection', async (socket) => {
    const user = socket.user;
    if (!user) return;

    console.log(`[Socket] Client connected: ${user.displayName} (ID: ${socket.id})`);

    // Join user-specific notification channel
    socket.join(`user_${user._id.toString()}`);
    console.log(`[Socket] Joined user channel: user_${user._id}`);

    // Register audio calling signaling handlers
    registerCallHandlers(io, socket);

    // Set online status in database
    try {
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { isOnline: true, lastSeen: new Date() },
        { new: true }
      );
      
      // Notify all connected clients of this user's online state
      io.emit('user_status_changed', {
        userId: user._id,
        isOnline: true,
        lastSeen: updatedUser.lastSeen,
      });
    } catch (err) {
      console.error(`[Socket Connect Error]: ${err.message}`);
    }

    // Join a room channel
    socket.on('join_room', (roomId) => {
      if (!roomId) return;
      socket.join(roomId);
      console.log(`[Socket] User ${user.displayName} joined socket room: ${roomId}`);
    });

    // Leave a room channel
    socket.on('leave_room', (roomId) => {
      if (!roomId) return;
      socket.leave(roomId);
      console.log(`[Socket] User ${user.displayName} left socket room: ${roomId}`);
    });

    // Receive message from client, write to DB, and broadcast
    socket.on('send_message', async ({ roomId, content, replyToId, type, fileUrl, fileName, fileSize, poll }) => {
      const hasContent = content && content.trim();
      const hasAttachment = fileUrl && fileUrl.trim();
      const hasPoll = type === 'poll' && poll && poll.question && poll.options && poll.options.length >= 2;
      if (!roomId || (!hasContent && !hasAttachment && !hasPoll)) return;

      try {
        // Double-check room membership for private rooms
        const room = await Room.findById(roomId);
        if (!room) {
          return socket.emit('error_message', 'Room not found');
        }

        if (!room.members.includes(user._id.toString())) {
          return socket.emit('error_message', 'Not authorized to send messages here');
        }

        let pollData = null;
        if (type === 'poll' && hasPoll) {
          pollData = {
            question: poll.question.trim(),
            options: poll.options.map((opt, index) => ({
              optionId: `opt_${Date.now()}_${index}`,
              text: opt.trim(),
              votes: [],
            })),
            allowMultipleAnswers: !!poll.allowMultipleAnswers,
          };
        }

        // Save message to MongoDB
        const newMessage = await Message.create({
          roomId,
          senderId: user._id,
          content: content ? content.trim() : '',
          text: content ? content.trim() : '',
          replyTo: replyToId || null,
          type: type || 'text',
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          poll: pollData,
        });

        // Populate sender info (displayName, email, avatarUrl) and replyTo details
        const populatedMessage = await Message.findById(newMessage._id)
          .populate('senderId', 'displayName username email avatarUrl')
          .populate({
            path: 'replyTo',
            select: 'content isDeleted senderId',
            populate: { path: 'senderId', select: 'displayName username' },
          });

        // Broadcast to all sockets connected to this room, include roomId for unread tracking
        io.to(roomId).emit('receive_message', { ...populatedMessage.toObject(), roomId });

        // Update Room updatedAt timestamp to sort recent rooms first
        await Room.findByIdAndUpdate(roomId, { updatedAt: new Date() });
      } catch (err) {
        console.error(`[Socket Send Message Error]: ${err.message}`);
        socket.emit('error_message', 'Failed to deliver message');
      }
    });

    // Vote on a poll option
    socket.on('vote_poll', async ({ messageId, optionId }) => {
      if (!messageId || !optionId) return;

      try {
        const message = await Message.findById(messageId);
        if (!message || message.type !== 'poll' || !message.poll) {
          return socket.emit('error_message', 'Poll message not found');
        }

        // Verify membership of room
        const room = await Room.findById(message.roomId);
        if (!room || !room.members.includes(user._id.toString())) {
          return socket.emit('error_message', 'Not authorized to vote here');
        }

        const userId = user._id.toString();
        const allowMultiple = message.poll.allowMultipleAnswers;

        // Map options and update votes array
        message.poll.options = message.poll.options.map((option) => {
          const hasVotedForThis = option.votes.some(v => v.toString() === userId);
          
          if (option.optionId === optionId) {
            // Toggle vote for the target option
            if (hasVotedForThis) {
              option.votes = option.votes.filter(v => v.toString() !== userId);
            } else {
              option.votes.push(user._id);
            }
          } else if (!allowMultiple) {
            // Remove user's vote from all other options if multiple options are not allowed
            option.votes = option.votes.filter(v => v.toString() !== userId);
          }
          return option;
        });

        await message.save();

        // Populate sender info and reply details to return full document structure
        const populatedMessage = await Message.findById(messageId)
          .populate('senderId', 'displayName username email avatarUrl')
          .populate({
            path: 'replyTo',
            select: 'content isDeleted senderId',
            populate: { path: 'senderId', select: 'displayName username' },
          });

        // Broadcast updated poll back to everyone in the room
        io.to(message.roomId.toString()).emit('poll_updated', populatedMessage.toObject());
      } catch (err) {
        console.error(`[Socket Vote Poll Error]: ${err.message}`);
        socket.emit('error_message', 'Failed to submit vote');
      }
    });

    // Typing notification trigger
    socket.on('typing', ({ roomId, isTyping }) => {
      if (!roomId) return;
      // Broadcast to other members in room
      socket.to(roomId).emit('user_typing', {
        roomId,
        userId: user._id,
        displayName: user.displayName,
        isTyping,
      });
    });

    // Toggle emoji reaction on a message
    socket.on('react_message', async ({ messageId, emoji }) => {
      if (!messageId || !emoji) return;
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        let reactions = Array.isArray(message.reactions) ? JSON.parse(JSON.stringify(message.reactions)) : [];
        const userIdStr = user._id.toString();

        const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);
        if (reactionIndex === -1) {
          // New emoji — create reaction entry
          reactions.push({ emoji, users: [user._id] });
        } else {
          const reaction = reactions[reactionIndex];
          const usersList = Array.isArray(reaction.users) ? reaction.users : [];
          const userIndex = usersList.findIndex(
            (id) => (id._id || id).toString() === userIdStr
          );
          if (userIndex === -1) {
            // Add user to existing reaction
            usersList.push(user._id);
            reaction.users = usersList;
          } else {
            // Toggle off — remove user from reaction
            usersList.splice(userIndex, 1);
            if (usersList.length === 0) {
              reactions.splice(reactionIndex, 1);
            } else {
              reaction.users = usersList;
            }
          }
        }

        // Direct atomic update in MongoDB so it is 100% saved
        await Message.findByIdAndUpdate(messageId, { reactions }, { new: true });

        // Broadcast updated reactions to the whole room
        const cleanReactions = reactions.map((r) => ({
          emoji: r.emoji,
          users: (r.users || []).map((u) => (u._id || u).toString()),
        }));

        io.to(message.roomId.toString()).emit('message_reaction_updated', {
          messageId: message._id.toString(),
          reactions: cleanReactions,
        });
      } catch (err) {
        console.error(`[Socket React Message Error]: ${err.message}`);
      }
    });

    // Edit a sent message (own messages only, non-system)
    socket.on('edit_message', async ({ messageId, newContent }) => {
      if (!messageId || !newContent?.trim()) return;
      try {
        const message = await Message.findById(messageId);
        if (!message) return socket.emit('error_message', 'Message not found');
        if (message.senderId?.toString() !== user._id.toString())
          return socket.emit('error_message', 'Cannot edit another user\'s message');
        if (message.isSystem || message.isDeleted) return;

        const updated = await Message.findByIdAndUpdate(
          messageId,
          { content: newContent.trim(), editedAt: new Date() },
          { new: true }
        );

        io.to(message.roomId.toString()).emit('message_edited', {
          messageId: message._id.toString(),
          content: updated.content,
          editedAt: updated.editedAt,
        });
      } catch (err) {
        console.error(`[Socket Edit Message Error]: ${err.message}`);
      }
    });

    // Soft-delete a sent message (own messages only)
    socket.on('delete_message', async ({ messageId }) => {
      if (!messageId) return;
      try {
        const message = await Message.findById(messageId);
        if (!message) return socket.emit('error_message', 'Message not found');
        if (message.senderId?.toString() !== user._id.toString())
          return socket.emit('error_message', 'Cannot delete another user\'s message');
        if (message.isSystem) return;

        await Message.findByIdAndUpdate(
          messageId,
          { isDeleted: true, content: '' },
          { new: true }
        );

        io.to(message.roomId.toString()).emit('message_deleted', {
          messageId: message._id.toString(),
        });
      } catch (err) {
        console.error(`[Socket Delete Message Error]: ${err.message}`);
      }
    });

    // Handle user disconnect
    socket.on('disconnect', async () => {
      console.log(`[Socket] Client disconnected: ${user.displayName} (ID: ${socket.id})`);
      try {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(user._id, { isOnline: false, lastSeen });

        // Notify other clients of offline state
        io.emit('user_status_changed', {
          userId: user._id,
          isOnline: false,
          lastSeen,
        });
      } catch (err) {
        console.error(`[Socket Disconnect Error]: ${err.message}`);
      }
    });
  });
}
