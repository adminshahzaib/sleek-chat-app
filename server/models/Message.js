import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    content: {
      type: String,
      required: false,
      default: '',
      trim: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    // Quoted reply reference
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    // Emoji reactions array
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    // Edit tracking
    editedAt: {
      type: Date,
      default: null,
    },
    // Soft delete flag
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Optional optimization: Compound index for sorting history inside a room
messageSchema.index({ roomId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
