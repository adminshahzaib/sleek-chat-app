import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Smile, Send, X, CornerUpLeft, Paperclip, Mic, Square, Loader2, BarChart2 } from 'lucide-react';
import { uploadToCloudinary } from '../../utils/cloudinaryUpload.js';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import PollCreatorModal from './PollCreatorModal.jsx';

export default function MessageInput({ onSendMessage, onTyping, replyingTo, onCancelReply }) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPollCreator, setShowPollCreator] = useState(false);

  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
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

  // Clear recording timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
    if (e.key === 'Escape' && replyingTo) {
      onCancelReply?.();
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);
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

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const limit = 10 * 1024 * 1024; // 10MB
    if (file.size > limit) {
      alert('File size exceeds the 10MB limit.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const targetReplyId = (replyingTo?._id || replyingTo?.id)?.toString() || null;
      const attachment = await uploadToCloudinary(file, 'auto');
      onSendMessage(message, targetReplyId, attachment);
      setMessage('');
    } catch (err) {
      console.error('[File Upload Error]:', err.message);
      alert('Failed to upload file: ' + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      mediaRecorderRef.current = stream; 

      const recorder = new RecordRTC(stream, {
        type: 'audio',
        recorderType: StereoAudioRecorder,
        mimeType: 'audio/wav',
        numberOfAudioChannels: 1,
        desiredSampRate: 44100,
        sampleRate: 44100,
      });

      audioChunksRef.current = recorder; 

      recorder.startRecording();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('[Microphone Permission Error]:', err.message);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    const recorder = audioChunksRef.current;
    const stream = mediaRecorderRef.current;

    if (recorder && isRecording) {
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      recorder.stopRecording(async () => {
        const blob = recorder.getBlob();
        
        // Stop stream tracks
        if (stream && stream.getTracks) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const file = new File([blob], 'voice-note.wav', { type: 'audio/wav' });

        setIsUploading(true);
        try {
          const targetReplyId = (replyingTo?._id || replyingTo?.id)?.toString() || null;
          const attachment = await uploadToCloudinary(file, 'auto');
          onSendMessage('', targetReplyId, attachment);
        } catch (err) {
          console.error('[Voice Note Upload Error]:', err.message);
          alert('Failed to upload voice note: ' + err.message);
        } finally {
          setIsUploading(false);
        }
      });
    }
  };

  const handleCreatePoll = (pollData) => {
    const targetReplyId = (replyingTo?._id || replyingTo?.id)?.toString() || null;
    onSendMessage('', targetReplyId, { type: 'poll', poll: pollData });
    setShowPollCreator(false);
  };

  return (
    <div className="relative px-4 py-3 md:px-6 md:py-4 bg-slate-900 border-t border-slate-800 shrink-0">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

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

      {/* Poll Creator Modal */}
      {showPollCreator && (
        <PollCreatorModal
          onClose={() => setShowPollCreator(false)}
          onCreatePoll={handleCreatePoll}
        />
      )}

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-indigo-600/10 border border-indigo-500/25 text-indigo-400 text-xs font-semibold animate-pulse select-none">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          <span>Uploading media to Cloudinary... Please wait.</span>
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
          disabled={isUploading}
          className={`p-2.5 rounded-xl border transition-colors shrink-0 ${showEmojiPicker
              ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-202'
            } disabled:opacity-40`}
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Attachment Button */}
        <button
          type="button"
          onClick={handleAttachmentClick}
          disabled={isUploading || isRecording}
          className="p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Poll Button */}
        <button
          type="button"
          onClick={() => setShowPollCreator(true)}
          disabled={isUploading || isRecording}
          className="p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-202 hover:border-slate-700 transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
          title="Create Poll"
        >
          <BarChart2 className="w-5 h-5" />
        </button>

        {/* Dynamic Input / Recording State View */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-red-950/20 border border-red-500/20 px-4 py-2 rounded-xl text-red-400 font-medium text-xs select-none animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
              <span>Recording Voice Note ({recordingTime}s)</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-650/20 hover:bg-red-600 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
            >
              <Square className="w-3 h-3" /> Stop
            </button>
          </div>
        ) : (
          <div className="flex-1">
            <textarea
              ref={inputRef}
              rows={1}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isUploading}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs resize-none max-h-24 scrollbar-hide align-middle disabled:opacity-50"
              placeholder={replyingTo ? 'Write your reply... (Enter to send, Esc to cancel)' : 'Write your message here...'}
            />
          </div>
        )}

        {/* Voice Note / Send Message Button */}
        {!message.trim() && !isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={isUploading}
            className="p-2.5 rounded-xl border bg-slate-955 border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/25 transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
            title="Record Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={(!message.trim() && !isRecording) || isUploading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
}
