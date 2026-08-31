import React, { useRef, useEffect } from 'react';
import useAudioCall from '../hooks/useAudioCall.js';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Video, VideoOff } from 'lucide-react';

export default function AudioCallModal() {
  const {
    callState,
    callType,
    partner,
    isMuted,
    isVideoMuted,
    callDuration,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useAudioCall();

  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  // Attach remote stream to remote video node
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  // Attach local stream to local PIP video node
  useEffect(() => {
    if (localVideoRef.current && localStream && callType === 'video') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callType, callState]);

  if (callState === 'IDLE') return null;

  // Format counter to MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const initialLetter = partner?.displayName ? partner.displayName[0].toUpperCase() : '?';
  const showVideoFeed = callType === 'video' && callState === 'CONNECTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      
      {/* Fallback hidden audio relay when in audio call mode */}
      {callType === 'audio' && (
        <audio ref={remoteVideoRef} autoPlay />
      )}

      <div className={`w-full ${showVideoFeed ? 'max-w-md' : 'max-w-sm'} bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-center space-y-6 flex flex-col items-center transition-all duration-300`}>
        
        {/* Ringing/Call Status Visual or Video Feed */}
        {showVideoFeed ? (
          <div className="relative w-full h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
            {/* Remote Video Stream */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Local Video Overlay (floating PiP) */}
            {!isVideoMuted && localStream && (
              <div className="absolute top-3 right-3 w-24 h-32 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl animate-in zoom-in-50 duration-350">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {/* Muted video overlay screen */}
            {isVideoMuted && (
              <div className="absolute top-3 right-3 w-24 h-32 rounded-xl border border-slate-800 bg-slate-900/90 flex items-center justify-center text-slate-500 text-[10px] font-bold uppercase shadow-2xl">
                Cam Off
              </div>
            )}
          </div>
        ) : (
          /* Pulsing profile circle for Audio Call or Ringing Video Call */
          <div className="relative">
            {(callState === 'CALLING' || callState === 'INCOMING') && (
              <>
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping scale-150 duration-1000"></div>
                <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping scale-125 duration-1000 delay-300"></div>
              </>
            )}
            {partner?.avatarUrl ? (
              <img
                src={partner.avatarUrl}
                alt={partner.displayName}
                className="w-24 h-24 rounded-full border-2 border-indigo-500/50 object-cover shadow-xl relative z-10"
              />
            ) : (
              <div className="w-24 h-24 rounded-full border-2 border-indigo-500/50 bg-indigo-650 flex items-center justify-center text-3xl font-extrabold text-white shadow-xl relative z-10 uppercase">
                {initialLetter}
              </div>
            )}
          </div>
        )}

        {/* Caller Metadata Info */}
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-100">{partner?.displayName || 'Unknown Profile'}</h3>
          <p className="text-xs text-slate-500">
            {partner?.username ? `@${partner.username}` : ''}
          </p>
        </div>

        {/* Dynamic Status / Call Duration Timer */}
        <div className="space-y-1">
          {callState === 'CALLING' && (
            <p className="text-xs font-semibold text-indigo-400 animate-pulse tracking-wide uppercase">
              Ringing {callType === 'video' ? 'Video' : 'Voice'} Call...
            </p>
          )}
          {callState === 'INCOMING' && (
            <p className="text-xs font-semibold text-emerald-400 animate-pulse tracking-wide uppercase">
              Incoming {callType === 'video' ? 'Video' : 'Voice'} Call Request
            </p>
          )}
          {callState === 'CONNECTED' && (
            <div className="flex flex-col items-center gap-1.5">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Connected
              </span>
              <p className="text-xl font-mono text-slate-100 font-bold tracking-widest">{formatTime(callDuration)}</p>
            </div>
          )}
        </div>

        {/* Modal Controls Buttons */}
        <div className="w-full flex items-center justify-center gap-4 pt-4 border-t border-slate-800/60">
          {callState === 'INCOMING' ? (
            <>
              {/* Reject call */}
              <button
                onClick={rejectCall}
                className="p-4 rounded-full bg-red-650 hover:bg-red-650/85 text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-600/35 cursor-pointer"
                title="Decline Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              {/* Accept call */}
              <button
                onClick={acceptCall}
                className="p-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-600/35 cursor-pointer"
                title="Accept Call"
              >
                <Phone className="w-6 h-6" />
              </button>
            </>
          ) : (
            <>
              {/* Mute Mic (Connected only) */}
              {callState === 'CONNECTED' && (
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                    isMuted
                      ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              )}

              {/* Mute Camera (Video call Connected state only) */}
              {showVideoFeed && (
                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-full border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                    isVideoMuted
                      ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                  title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
                >
                  {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
              )}

              {/* End call (Calling or Connected) */}
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-650 hover:bg-red-600 text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-650/35 cursor-pointer"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
