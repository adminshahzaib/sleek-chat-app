import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

const CallContext = createContext(null);

const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

export function CallProvider({ children }) {
  const { socket } = useSocket();
  const [callState, setCallState] = useState('IDLE'); // IDLE, CALLING, INCOMING, CONNECTED, DISCONNECTED
  const [callType, setCallType] = useState('audio'); // audio or video
  const [partner, setPartner] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);

  // Clean up WebRTC peer connections and media tracks
  const cleanupCall = () => {
    setCallState('IDLE');
    setPartner(null);
    setIsMuted(false);
    setIsVideoMuted(false);
    setCallDuration(0);
    setLocalStream(null);
    setRemoteStream(null);
    incomingOfferRef.current = null;
    iceCandidatesQueueRef.current = [];

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  // Helper to obtain local mic/camera stream
  const obtainLocalStream = async (type = callType) => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: type === 'video' ? {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] Microphone/Camera permission denied:', err.message);
      alert('Could not access microphone/camera. Please check permissions.');
      cleanupCall();
      throw err;
    }
  };

  // Helper to setup RTCPeerConnection
  const setupPeerConnection = async (partnerId, type = callType) => {
    const pc = new RTCPeerConnection(PEER_CONFIG);
    pcRef.current = pc;

    // Send local tracks
    const stream = await obtainLocalStream(type);
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          to: partnerId,
          candidate: event.candidate,
        });
      }
    };

    // Handle incoming remote track stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Detect state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanupCall();
      }
    };

    return pc;
  };

  // Initiate call to partner
  const startCall = async (targetUser, type = 'audio') => {
    if (!targetUser || !targetUser._id) return;
    try {
      setCallType(type);
      setCallState('CALLING');
      setPartner(targetUser);

      const pc = await setupPeerConnection(targetUser._id.toString(), type);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket?.emit('call-user', {
        to: targetUser._id.toString(),
        offer,
        callType: type,
      });
    } catch (err) {
      console.error('[WebRTC] Outgoing call initialization failed:', err);
      cleanupCall();
    }
  };

  // Accept incoming call offer
  const acceptCall = async () => {
    if (!partner || !incomingOfferRef.current) return;
    try {
      setCallState('CONNECTED');

      const pc = await setupPeerConnection(partner._id.toString(), callType);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      
      // Process any queued ICE candidates
      if (iceCandidatesQueueRef.current.length > 0) {
        for (const candidate of iceCandidatesQueueRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('[WebRTC] Queued ICE candidate insertion failed:', err);
          }
        }
        iceCandidatesQueueRef.current = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket?.emit('answer-call', {
        to: partner._id.toString(),
        answer,
      });

      // Start duration counter
      setCallDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('[WebRTC] Call acceptance failed:', err);
      cleanupCall();
    }
  };

  // Reject incoming call trigger
  const rejectCall = () => {
    if (partner) {
      socket?.emit('reject-call', { to: partner._id.toString() });
    }
    cleanupCall();
  };

  // End active call session
  const endCall = () => {
    if (partner) {
      socket?.emit('end-call', { to: partner._id.toString() });
    }
    cleanupCall();
  };

  // Toggle mic mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted; // Toggle enabled state
        setIsMuted(!isMuted);
      }
    }
  };

  // Toggle camera disable
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoMuted; // Toggle enabled state
        setIsVideoMuted(!isVideoMuted);
      }
    }
  };

  // Connect socket signaling listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming Call trigger
    const handleIncomingCall = ({ from, offer, callType }) => {
      if (callState !== 'IDLE') {
        // Busy state: reject automatically
        socket.emit('reject-call', { to: from._id.toString() });
        return;
      }
      setCallType(callType || 'audio');
      setCallState('INCOMING');
      setPartner(from);
      incomingOfferRef.current = offer;
    };

    // Call Accepted trigger
    const handleCallAccepted = async ({ answer }) => {
      if (callState !== 'CALLING' || !pcRef.current) return;
      try {
        setCallState('CONNECTED');
        const pc = pcRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process any queued ICE candidates
        if (iceCandidatesQueueRef.current.length > 0) {
          for (const candidate of iceCandidatesQueueRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('[WebRTC] Queued ICE candidate insertion failed:', err);
            }
          }
          iceCandidatesQueueRef.current = [];
        }

        // Start duration counter
        setCallDuration(0);
        timerIntervalRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('[WebRTC] Set remote description failed:', err);
        cleanupCall();
      }
    };

    // Call Rejected trigger
    const handleCallRejected = () => {
      cleanupCall();
      alert('Call was declined.');
    };

    // Call Ended trigger
    const handleCallEnded = () => {
      cleanupCall();
    };

    // Relay Ice Candidates
    const handleIceCandidate = async ({ candidate }) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] ICE candidate insertion failed:', err);
        }
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [socket, callState, callType]);

  // Handle component unmount lifecycle cleanup
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        partner,
        isMuted,
        isVideoMuted,
        callDuration,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useAudioCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useAudioCall must be used within a CallProvider');
  }
  return context;
}
