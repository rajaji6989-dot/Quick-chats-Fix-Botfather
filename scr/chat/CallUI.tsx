import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { updateCallStatus, sendSignal, getICEServers, logCallMessage } from '@/lib/calls';
import { supabase } from '@/integrations/supabase/client';

interface CallUIProps {
  call: any;
  otherUser: any;
  currentUserId: string;
  isIncoming: boolean;
  onEnd: () => void;
}

export default function CallUI({ call, otherUser, currentUserId, isIncoming, onEnd }: CallUIProps) {
  const [callStatus, setCallStatus] = useState(call.status || 'ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(call.call_type === 'voice');
  const [duration, setDuration] = useState(0);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    try { peerRef.current?.close(); } catch {}
    peerRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const finalize = useCallback(async (status: 'ended' | 'rejected' | 'missed') => {
    if (endedRef.current) return;
    endedRef.current = true;
    const dur = startedAtRef.current ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0;
    await updateCallStatus(call.id, status);
    // Caller logs the call message into chat
    if (call.caller_id === currentUserId) {
      await logCallMessage(call.conversation_id, {
        call_type: call.call_type,
        caller_id: call.caller_id,
        receiver_id: call.receiver_id,
        status: dur > 0 ? 'ended' : status,
        duration: dur,
      });
    }
    cleanup();
    onEnd();
  }, [call, currentUserId, cleanup, onEnd]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      // Get media first
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.call_type === 'video',
        });
      } catch (err) {
        console.error('getUserMedia failed', err);
        await finalize('ended');
        return;
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;
      if (localVideoRef.current && call.call_type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: getICEServers() });
      peerRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(call.id, 'ice-candidate', e.candidate.toJSON());
      };

      pc.ontrack = (e) => {
        const [rstream] = e.streams;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rstream;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = rstream;
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          if (!startedAtRef.current) {
            startedAtRef.current = Date.now();
            setCallStatus('active');
            updateCallStatus(call.id, 'active');
            timerRef.current = setInterval(() => {
              if (startedAtRef.current) {
                setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
              }
            }, 1000);
          }
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          finalize('ended');
        }
      };

      // If caller, create offer immediately (incoming side just waits)
      if (!isIncoming) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: call.call_type === 'video',
        });
        await pc.setLocalDescription(offer);
        await sendSignal(call.id, 'offer', { type: offer.type, sdp: offer.sdp });
      }
    };

    setup();

    const channel = supabase
      .channel(`call-signals-${call.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'call_signals',
        filter: `call_id=eq.${call.id}`,
      }, async (payload: any) => {
        const signal = payload.new;
        if (signal.sender_id === currentUserId) return;
        const pc = peerRef.current;
        if (!pc) return;
        try {
          if (signal.signal_type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
            remoteDescSetRef.current = true;
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(call.id, 'answer', { type: answer.type, sdp: answer.sdp });
            // Drain queued candidates
            for (const c of pendingCandidatesRef.current) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
            }
            pendingCandidatesRef.current = [];
          } else if (signal.signal_type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
            remoteDescSetRef.current = true;
            for (const c of pendingCandidatesRef.current) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
            }
            pendingCandidatesRef.current = [];
          } else if (signal.signal_type === 'ice-candidate') {
            if (remoteDescSetRef.current) {
              try { await pc.addIceCandidate(new RTCIceCandidate(signal.signal_data)); } catch {}
            } else {
              pendingCandidatesRef.current.push(signal.signal_data);
            }
          }
        } catch (err) {
          console.error('Signal handling error', err);
        }
      })
      .subscribe();

    const callChannel = supabase
      .channel(`call-status-${call.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'calls',
        filter: `id=eq.${call.id}`,
      }, (payload: any) => {
        const newStatus = payload.new.status;
        setCallStatus(newStatus);
        if (newStatus === 'ended' || newStatus === 'rejected' || newStatus === 'missed') {
          if (!endedRef.current) {
            endedRef.current = true;
            cleanup();
            onEnd();
          }
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(callChannel);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndCall = () => finalize('ended');

  const toggleMute = () => {
    const a = localStreamRef.current?.getAudioTracks()[0];
    if (a) { a.enabled = !a.enabled; setIsMuted(!a.enabled); }
  };
  const toggleVideo = () => {
    const v = localStreamRef.current?.getVideoTracks()[0];
    if (v) { v.enabled = !v.enabled; setIsVideoOff(!v.enabled); }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-between py-12">
      {call.call_type === 'video' && (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      )}
      {call.call_type === 'video' && !isVideoOff && (
        <video
          ref={localVideoRef}
          autoPlay playsInline muted
          className="absolute top-20 right-4 w-28 h-40 rounded-xl object-cover border-2 border-border z-10"
        />
      )}
      {/* Audio sink for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className={`relative z-10 flex flex-col items-center justify-between h-full w-full ${call.call_type === 'video' ? 'bg-background/30' : ''}`}>
        <div className="flex flex-col items-center gap-4 mt-12">
          <Avatar className="w-24 h-24 border-4 border-primary/30">
            {otherUser?.avatar_url && <AvatarImage src={otherUser.avatar_url} />}
            <AvatarFallback className="bg-primary/20 text-primary text-3xl font-bold">
              {otherUser?.username?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-xl font-semibold text-foreground">@{otherUser?.username}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {callStatus === 'ringing' ? (isIncoming ? 'Connecting...' : 'Calling...') :
               callStatus === 'active' ? formatDuration(duration) : callStatus}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          {call.call_type === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
          <span className="text-sm capitalize">{call.call_type} Call</span>
        </div>

        <div className="flex items-center gap-6 mb-12">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-foreground'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          {call.call_type === 'video' && (
            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isVideoOff ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-foreground'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground shadow-lg"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
