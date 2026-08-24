import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Smile, Send, X, CornerUpLeft } from 'lucide-react';

export default function MessageInput({ onSendMessage, onTyping, replyingTo, onCancelReply }) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Close emoji picker if clicking outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when reply target is set
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const targetReplyId = (replyingTo?._id || replyingTo?.id)?.toString() || null;
    onSendMessage(message, targetReplyId);
    setMessage('');
    setShowEmojiPicker(false);

    // Cancel active typing status
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping(false);

    // Maintain input focus
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Submit on Enter, unless Shift is pressed
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
    // Escape cancels reply
    if (e.key === 'Escape' && replyingTo) {
      onCancelReply?.();
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);

    // Emit live typing indicator
    onTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleEmojiClick = (emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="relative px-6 py-4 bg-slate-900 border-t border-slate-800 shrink-0">
      {/* Emoji Picker Popover overlay */}
      {showEmojiPicker && (
        <div ref={pickerRef} className="absolute bottom-16 left-6 z-40 shadow-2xl">
          <EmojiPicker
            theme="dark"
            onEmojiClick={handleEmojiClick}
            skinTonesDisabled
            searchDisabled={false}
            width={320}
            height={360}
          />
        </div>
      )}

      {/* Reply Preview Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-xl bg-indigo-600/10 border border-indigo-500/25">
          <div className="flex items-center gap-2 min-w-0">
            <CornerUpLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide">
                Replying to {replyingTo.senderId?.username
                  ? `@${replyingTo.senderId.username}`
                  : replyingTo.senderId?.displayName || 'Unknown'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {replyingTo.isDeleted ? 'Message deleted' : replyingTo.content}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-3">
        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className={`p-2.5 rounded-xl border transition-colors shrink-0 ${
            showEmojiPicker
              ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Message Input Field */}
        <div className="flex-1">
          <textarea
            ref={inputRef}
            rows={1}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs resize-none max-h-24 scrollbar-hide align-middle"
            placeholder={replyingTo ? 'Write your reply... (Enter to send, Esc to cancel)' : 'Write your message here... (Enter to send, Shift+Enter for new line)'}
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim()}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
