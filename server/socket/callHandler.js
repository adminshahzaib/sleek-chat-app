/**
 * WebRTC 1-on-1 audio call signaling handlers.
 * Leverages the built-in `user_${userId}` socket rooms to route signaling data.
 */
export default function registerCallHandlers(io, socket) {
  const user = socket.user;
  if (!user) return;

  const getPartnerRoom = (partnerId) => `user_${partnerId}`;

  // Caller initiates call, sends offer SDP to recipient
  socket.on('call-user', ({ to, offer, callType }) => {
    if (!to || !offer) return;
    
    // Track active call partner ID on current socket instance
    socket.activeCallPartnerId = to;
    
    // Emit incoming-call event to the recipient room
    socket.to(getPartnerRoom(to)).emit('incoming-call', {
      from: {
        _id: user._id.toString(),
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
      offer,
      callType: callType || 'audio',
    });
    console.log(`[Call Signaling] User ${user.displayName} offering ${callType || 'audio'} call to user ID: ${to}`);
  });

  // Receiver accepts call, sends back SDP answer
  socket.on('answer-call', ({ to, answer }) => {
    if (!to || !answer) return;

    socket.activeCallPartnerId = to;
    
    // Relay answer SDP back to caller
    socket.to(getPartnerRoom(to)).emit('call-accepted', {
      answer,
    });
    console.log(`[Call Signaling] User ${user.displayName} answered call from user ID: ${to}`);
  });

  // Relay ICE candidates between caller and receiver
  socket.on('ice-candidate', ({ to, candidate }) => {
    if (!to || !candidate) return;

    socket.to(getPartnerRoom(to)).emit('ice-candidate', {
      candidate,
    });
  });

  // Receiver declines the call
  socket.on('reject-call', ({ to }) => {
    if (!to) return;

    socket.activeCallPartnerId = null;

    // Notify caller that call was declined
    socket.to(getPartnerRoom(to)).emit('call-rejected');
    console.log(`[Call Signaling] User ${user.displayName} rejected call from user ID: ${to}`);
  });

  // Either party hangs up the call
  socket.on('end-call', ({ to }) => {
    if (!to) return;

    socket.activeCallPartnerId = null;

    // Notify partner that call was terminated
    socket.to(getPartnerRoom(to)).emit('call-ended');
    console.log(`[Call Signaling] Call ended between ${user.displayName} and user ID: ${to}`);
  });

  // Handle call cleanup if socket disconnects unexpectedly during a call
  socket.on('disconnect', () => {
    if (socket.activeCallPartnerId) {
      socket.to(getPartnerRoom(socket.activeCallPartnerId)).emit('call-ended', {
        reason: 'Partner disconnected',
      });
      console.log(`[Call Signaling] Call partner disconnected for active session. Cleaning up.`);
    }
  });
}
