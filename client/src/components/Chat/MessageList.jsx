import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ChevronDown, Reply, Pencil, Trash2, Check, X, CornerUpLeft, FileText, Download } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function formatBytes(bytes, decimals = 2) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function MessageList({ messages, onReply, onEdit, onDelete, onReact, onVotePoll }) {
  const { mongoUser, contactsMap } = useAuth();
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [hasNewWhileScrolled, setHasNewWhileScrolled] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  // Track scroll position — show button when > 150px from bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 150);
  }, []);

  // Auto-scroll to bottom when messages first load or user is at bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom <= 150) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasNewWhileScrolled(false);
    } else {
      setHasNewWhileScrolled(true);
    }
  }, [messages]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewWhileScrolled(false);
  };

  const startEdit = (msg) => {
    setEditingId(msg._id);
    setEditContent(msg.content);
  };

  const submitEdit = (msgId) => {
    if (editContent.trim() && editContent.trim() !== '') {
      onEdit(msgId, editContent.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const formatTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  const renderMessageText = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, idx) => {
      if (urlRegex.test(part)) {
        return (
          <a key={idx} href={part} target="_blank" rel="noopener noreferrer"
            className="underline hover:text-indigo-200 break-all font-semibold">
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const getDisplayName = (msg) => {
    if (!msg.senderId) return 'Colleague';
    return contactsMap[msg.senderId._id] ||
      (msg.senderId.username ? `@${msg.senderId.username}` : msg.senderId.displayName);
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <p className="text-xs font-bold uppercase tracking-wider mb-1">Silence is golden</p>
            <p className="text-[10px] text-slate-600">Type a message below to kick off conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const msgId = (msg._id || msg.id)?.toString();
            const senderIdStr = (msg.senderId?._id || msg.senderId)?.toString();
            const isSentByMe = senderIdStr === mongoUser?._id?.toString();
            const isEditing = editingId && msgId && editingId.toString() === msgId.toString();

            const showDateDivider =
              index === 0 ||
              new Date(messages[index - 1].createdAt).toDateString() !==
              new Date(msg.createdAt).toDateString();

            return (
              <div key={msgId || index} className="space-y-3">
                {showDateDivider && (
                  <div className="relative flex items-center my-6">
                    <div className="w-full border-t border-slate-800/80"></div>
                    <div className="absolute left-1/2 -translate-x-1/2 bg-slate-950 px-3 text-[9px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">
                      {formatDate(msg.createdAt)}
                    </div>
                  </div>
                )}

                {msg.isSystem ? (
                  <div className="flex justify-center my-3 select-none">
                    <div className="bg-slate-950/60 border border-slate-850 px-3.5 py-1.5 rounded-full text-[10px] text-slate-450 font-semibold tracking-wide text-center max-w-[85%] shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : msg.isDeleted ? (
                  /* Soft-deleted placeholder */
                  <div className={`flex items-end gap-2.5 ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="px-3.5 py-2 rounded-2xl text-xs italic text-slate-500 bg-slate-900/50 border border-slate-800/60 border-dashed">
                      Message deleted
                    </div>
                  </div>
                ) : (
                  /* Normal message bubble with hover interaction */
                  <div tabIndex={0} className={`group flex items-end gap-2.5 focus:outline-none ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                    {/* Received avatar */}
                    {!isSentByMe && (
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 p-0.5 shrink-0 mb-1">
                        <img
                          src={msg.senderId?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.senderId?.email}`}
                          alt="" className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    <div className={`flex flex-col max-w-[70%] ${isSentByMe ? 'items-end' : 'items-start'}`}>
                      {/* Sender + time header */}
                      <div className="flex items-center gap-1.5 px-1 mb-1">
                        {!isSentByMe && (
                          <span className="text-[10px] font-bold text-slate-400">{getDisplayName(msg)}</span>
                        )}
                        <span className="text-[8px] text-slate-600 font-semibold uppercase">
                          {formatTime(msg.createdAt)}
                          {msg.editedAt && <span className="ml-1 text-slate-600 italic">(edited)</span>}
                        </span>
                      </div>

                      {/* Quoted reply block */}
                      {msg.replyTo && !msg.replyTo.isDeleted && (
                        <div className="mb-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/60 border-l-2 border-indigo-500/60 max-w-full">
                          <div className="flex items-center gap-1 mb-0.5">
                            <CornerUpLeft className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                            <span className="text-[9px] font-bold text-indigo-400">
                              {msg.replyTo.senderId?.username
                                ? `@${msg.replyTo.senderId.username}`
                                : msg.replyTo.senderId?.displayName || 'Unknown'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate max-w-[240px]">
                            {msg.replyTo.content}
                          </p>
                        </div>
                      )}

                      {/* Inline edit mode OR message bubble */}
                      {isEditing ? (
                        <div className="w-full flex flex-col gap-1.5">
                          <textarea
                            autoFocus
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msgId); }
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-indigo-500/50 text-slate-100 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex gap-1 justify-end">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => submitEdit(msgId)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                            >
                              <Check className="w-3 h-3" /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Hover action bar */}
                          <div className={`absolute -top-8 ${isSentByMe ? 'right-0' : 'left-0'} hidden group-hover:flex group-focus-within:flex group-active:flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-xl px-1.5 py-1 shadow-lg z-10`}>
                            {/* Quick emoji reactions */}
                            {QUICK_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => onReact(msgId, emoji)}
                                className="text-sm hover:scale-125 transition-transform px-0.5 leading-none"
                                title={`React with ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                            <div className="w-px h-4 bg-slate-700 mx-0.5" />
                            {/* Reply */}
                            <button
                              type="button"
                              onClick={() => onReply(msg)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                              title="Reply"
                            >
                              <Reply className="w-3 h-3" />
                            </button>
                            {/* Edit & Delete (own messages only) */}
                            {isSentByMe && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(msg)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                  title="Edit message"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDelete(msgId)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>

                          {/* Message bubble */}
                          <div className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-sm break-words ${isSentByMe
                              ? 'bg-indigo-600 text-white rounded-br-none'
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                            }`}>
                            {msg.type === 'image' && msg.fileUrl && (
                              <div className="mb-1.5 max-w-xs overflow-hidden rounded-xl bg-slate-950 border border-slate-800/40">
                                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={msg.fileUrl}
                                    alt={msg.fileName || 'Image'}
                                    className="w-full max-h-60 object-cover hover:scale-105 transition-transform duration-200 cursor-pointer"
                                  />
                                </a>
                              </div>
                            )}

                            {msg.type === 'audio' && msg.fileUrl && (
                              <div className="mb-1.5 min-w-[200px] md:min-w-[240px] py-1">
                                <audio
                                  src={msg.fileUrl}
                                  controls
                                  className="w-full accent-indigo-600 h-8 rounded-lg"
                                />
                              </div>
                            )}

                            {msg.type === 'file' && msg.fileUrl && (
                              <div className="mb-1.5 p-2 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/60 rounded-xl flex items-center justify-between gap-3 min-w-[200px] md:min-w-[240px] max-w-xs transition-colors shadow-inner select-none">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-2 bg-indigo-600/10 border border-indigo-500/25 rounded-lg text-indigo-400 shrink-0">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-250 truncate" title={msg.fileName}>
                                      {msg.fileName}
                                    </p>
                                    <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">
                                      {msg.fileSize ? formatBytes(msg.fileSize) : 'Unknown size'}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={msg.fileUrl}
                                  download={msg.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white rounded-lg text-slate-400 transition-colors shrink-0 cursor-pointer"
                                  title="Download File"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}

                            {msg.type === 'poll' && msg.poll && (
                              <div className="mb-1.5 p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl min-w-[220px] md:min-w-[260px] max-w-xs shadow-inner space-y-3 select-none text-left">
                                {/* Poll Header */}
                                <div className="space-y-0.5">
                                  <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Channel Poll</span>
                                  <h4 className="text-[11px] font-bold text-slate-100 leading-snug">{msg.poll.question}</h4>
                                  <p className="text-[8px] text-slate-500 font-semibold">
                                    {msg.poll.allowMultipleAnswers ? 'Multiple choice' : 'Single choice'}
                                  </p>
                                </div>

                                {/* Options List */}
                                <div className="space-y-1.5">
                                  {msg.poll.options.map((option) => {
                                    // Total votes count
                                    const totalVotes = msg.poll.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0);
                                    const optionVotesCount = option.votes?.length || 0;
                                    const percentage = totalVotes > 0 ? Math.round((optionVotesCount / totalVotes) * 100) : 0;

                                    const currentUserId = mongoUser?._id?.toString() || mongoUser?.id?.toString();
                                    const hasVoted = option.votes?.some(v => (v._id || v)?.toString() === currentUserId);

                                    return (
                                      <div
                                        key={option.optionId}
                                        onClick={() => onVotePoll?.((msg._id || msg.id), option.optionId)}
                                        className={`group/opt relative p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-center overflow-hidden ${
                                          hasVoted
                                            ? 'bg-indigo-600/10 border-indigo-500/35'
                                            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                                        }`}
                                      >
                                        {/* Background Progress Fill */}
                                        <div
                                          className={`absolute left-0 top-0 bottom-0 transition-all duration-300 pointer-events-none ${
                                            hasVoted ? 'bg-indigo-500/15' : 'bg-slate-800/40'
                                          }`}
                                          style={{ width: `${percentage}%` }}
                                        />

                                        {/* Option Content */}
                                        <div className="relative z-10 flex items-center justify-between text-[10px] font-semibold text-slate-200">
                                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                            {hasVoted ? (
                                              <span className="w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] text-white shrink-0 shadow shadow-indigo-500/20">
                                                ✓
                                              </span>
                                            ) : (
                                              <span className="w-3.5 h-3.5 border border-slate-700 rounded-full flex items-center justify-center text-[9px] text-slate-600 shrink-0 group-hover/opt:border-slate-500 transition-colors" />
                                            )}
                                            <span className="truncate">{option.text}</span>
                                          </div>
                                          <div className="flex items-center gap-1 text-[9px] text-slate-400 shrink-0 font-bold">
                                            <span>{percentage}%</span>
                                            <span className="text-[7.5px] text-slate-600 font-normal">({optionVotesCount})</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Poll Footer */}
                                <div className="flex items-center justify-between pt-1.5 text-[8px] text-slate-500 border-t border-slate-900/50">
                                  <span>
                                    Total votes: {msg.poll.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Render text content if present (optional caption for images/files, or normal text message) */}
                            {((msg.type === 'text' || !msg.type) || (msg.content && msg.content.trim())) && (
                              <p className={msg.type && msg.type !== 'text' ? 'mt-1 text-slate-350' : ''}>
                                {renderMessageText(msg.content)}
                              </p>
                            )}
                          </div>

                          {/* Reaction pills */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {msg.reactions.map((r) => {
                                const iMineReacted = r.users?.some(
                                  (uid) => (uid?._id || uid)?.toString() === mongoUser?._id?.toString()
                                );
                                return (
                                  <button
                                    key={r.emoji}
                                    type="button"
                                    onClick={() => onReact(msgId, r.emoji)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all hover:scale-105 ${iMineReacted
                                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-indigo-500/30'
                                      }`}
                                  >
                                    <span>{r.emoji}</span>
                                    <span>{r.users?.length || 0}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sent avatar */}
                    {isSentByMe && (
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 p-0.5 shrink-0 mb-1">
                        <img
                          src={mongoUser?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${mongoUser?.email}`}
                          alt="" className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-Bottom Button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-20 flex items-center justify-center w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-110 active:scale-95 border border-indigo-400/30"
          title="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5" />
          {hasNewWhileScrolled && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-slate-950 animate-pulse" />
          )}
        </button>
      )}
    </div>
  );
}
