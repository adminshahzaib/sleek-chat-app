import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Smile, Send, X, CornerUpLeft, Paperclip, Mic, Square, Trash2 } from 'lucide-react';
import { uploadFileToStorage } from '../../utils/firebaseStorage.js';

export default function MessageInput({ onSendMessage, onTyping, replyingTo, onCancelReply }) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // File upload state
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);

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

  // Voice note timer effect
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingDuration(0);
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

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

  // Handle File Input Selection and Upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation: Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds the 5MB limit.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const isImage = file.type.startsWith('image/');
      const folder = isImage ? 'images' : 'documents';

      const uploadRes = await uploadFileToStorage(file, folder, (progress) => {
        setUploadProgress(progress);
      });

      const targetReplyId = (replyingTo?._id || replyingTo?.id)?.toString() || null;
      onSendMessage('', targetReplyId, {
        messageType: isImage ? 'image' : 'file',
        fileUrl: uploadRes.downloadUrl,
        fileName: uploadRes.fileName,
        fileSize: uploadRes.fileSize,
      });
    } catch (err) {
      console.error('[File Attachment] Upload failed:', err.message);
      alert('Failed to upload file attachment.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear value
      }
    }
  };

  // Start MediaRecorder audio capture
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const options = { mimeType: 'audio/webm' };
      const recorder = MediaRecorder.isTypeSupported('audio/webm')
        ? new MediaRecorder(stream, options)
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Shutdown all active tracks to disable browser tab mic warning
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;

        // Discard recording if user requested cancel
        if (recorder.isCanceled) {
          audioChunksRef.current = [];
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        try {
          setIsUploading(true);
          setUploadProgress(0);

          const uploadRes = await uploadFileToStorage(audioBlob, 'voice-notes', (progress) => {
            setUploadProgress(progress);
          });

          const targetReplyId = (replyingTo?._id || replyingTo?.id)?.toString() || null;
          onSendMessage('', targetReplyId, {
            messageType: 'audio',
            fileUrl: uploadRes.downloadUrl,
            fileName: 'Voice Note.webm',
            fileSize: audioBlob.size,
          });
        } catch (err) {
          console.error('[Voice Recording] Upload failed:', err.message);
          alert('Failed to upload voice note.');
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      };

      recorder.isCanceled = false;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('[Voice Recording] Access error:', err.message);
      alert('Microphone access denied or not supported.');
    }
  };

  // Stop recording and trigger save/upload
  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Discard recording
  const cancelRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.isCanceled = true;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Format record timer (e.g. 0:05)
  const formatDuration = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="relative px-4 py-3 md:px-6 md:py-4 bg-slate-900 border-t border-slate-800 shrink-0">
      {/* Uploading progress bar indicator */}
      {isUploading && (
        <div 
          className="absolute inset-x-0 -top-0.5 bg-indigo-650 h-0.5 z-50 transition-all duration-150"
          style={{ width: `${uploadProgress}%` }}
        />
      )}

      {/* Emoji Picker Popover overlay */}
      {showEmojiPicker && (
        <div ref={pickerRef} className="absolute bottom-16 left-4 md:left-6 z-40 shadow-2xl w-80 max-w-[calc(100vw-32px)]">
          <EmojiPicker
            theme="dark"
            onEmojiClick={handleEmojiClick}
            skinTonesDisabled
            searchDisabled={false}
            width="100%"
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

      {/* Responsive Input Panel */}
      {isRecording ? (
        <div className="flex items-center justify-between gap-3 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="text-xs font-bold text-red-500 uppercase tracking-wide">Recording Voice Note</span>
            <span className="text-xs font-mono text-slate-450 font-bold ml-1">{formatDuration(recordingDuration)}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Discard recording */}
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/20 border border-slate-800 text-slate-500 hover:text-red-400 transition-all cursor-pointer active:scale-95"
              title="Discard recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {/* Stop and Send */}
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer active:scale-95"
              title="Send recording"
            >
              <Square className="w-4 h-4 fill-white" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex items-center gap-3">
          {/* File selector attachment button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors shrink-0 cursor-pointer disabled:opacity-40"
            disabled={isUploading}
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

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
              disabled={isUploading}
            />
          </div>

          {/* Send OR Microphone recorder button */}
          {message.trim() ? (
            <button
              type="submit"
              disabled={isUploading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={isUploading}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors shrink-0 cursor-pointer disabled:opacity-40"
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
