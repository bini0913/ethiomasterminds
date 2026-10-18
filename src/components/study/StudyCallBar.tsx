import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, Check, X, Circle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { useFriends, type FriendPresence } from "@/context/FriendsContext";

const db = supabase as any;
type Invitation = { room_id: string; user_id: string; invited_by: string; status: string };
type Friend = { id: string; name?: string; username?: string };

export default function StudyCallBar() {
  const { user } = useUser();
  const { friends, onlineFriends, friendPresence, refreshFriends, loading: friendsLoading } = useFriends();
  const [expanded, setExpanded] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState("");
  const [incoming, setIncoming] = useState<Invitation[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [members, setMembers] = useState(0);
  const [callStatus, setCallStatus] = useState("Ready to connect");
  const [videoTracks, setVideoTracks] = useState<Array<{ track: Track; identity: string }>>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const displayName = (friend: Friend) => friend.username?.trim() || (friend.name?.trim() && !/^User [0-9a-f]{8}$/i.test(friend.name.trim()) ? friend.name.trim() : "Friend (profile unavailable)");
  const presenceLabel = (presence?: FriendPresence) => {
    if (!presence?.lastSeen) return "Offline";
    const age = Date.now() - new Date(presence.lastSeen).getTime();
    return presence.status === "online" && age >= 0 && age < 120000 ? "Online" : "Offline";
  };
  useEffect(() => { if (!selectedFriend && friends.length) setSelectedFriend(onlineFriends[0]?.id || friends[0].id); }, [friends, onlineFriends, selectedFriend]);

  const loadInvitations = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await db.from("study_call_participants").select("room_id,user_id,invited_by,status")
      .eq("user_id", user.id).eq("status", "invited").order("created_at", { ascending: false });
    if (!error) setIncoming((data ?? []) as Invitation[]);
  }, [user?.id]);

  useEffect(() => {
    void loadInvitations();
    if (!user?.id) return;
    const channel = supabase.channel(`study-call-invites-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_call_participants", filter: `user_id=eq.${user.id}` }, () => void loadInvitations())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, loadInvitations]);

  const connect = async (id: string) => {
    if (!user) return;
    setConnecting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error("Please sign in again.");
      const { data, error } = await supabase.functions.invoke("study-call-token", {
        body: { roomName: id },
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      if (error || !data?.token || !data?.serverUrl) throw new Error(data?.error || error?.message || "Calling is not configured yet.");
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.ParticipantConnected, () => setMembers(room.remoteParticipants.size + 1));
      room.on(RoomEvent.ParticipantDisconnected, () => setMembers(room.remoteParticipants.size + 1));
      room.on(RoomEvent.ConnectionStateChanged, state => setCallStatus("Call " + state.toLowerCase()));
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Video) {
          setVideoTracks(current => current.some(item => item.track === track) ? current : [...current, { track, identity: participant.identity }]);
        } else if (track.kind === Track.Kind.Audio) {
          const element = track.attach();
          element.autoplay = true;
          element.setAttribute("data-study-call-audio", "true");
          document.body.appendChild(element);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, track => {
        track.detach().forEach(element => element.remove());
        setVideoTracks(current => current.filter(item => item.track !== track));
      });
      room.on(RoomEvent.Disconnected, () => {
        setRoomId(null); setMembers(0); setCameraOn(false); setCallStatus("Disconnected"); setVideoTracks([]);
        document.querySelectorAll("[data-study-call-audio]").forEach(element => element.remove());
      });
      setCallStatus("Connecting…");
      await room.connect(data.serverUrl, data.token);
      roomRef.current = room;
      try { await room.localParticipant.setMicrophoneEnabled(true); setMuted(false); }
      catch { setMuted(true); toast.error("Call connected, but microphone access was blocked. Allow microphone access in browser site settings."); }
      setRoomId(id); setMembers(room.remoteParticipants.size + 1); setCallStatus("Connected");
      toast.success("Joined study call. Turn your camera on when ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join call.");
    } finally { setConnecting(false); }
  };

  const startCall = async () => {
    if (!selectedFriend) { toast.error("Choose a friend first."); return; }
    setConnecting(true);
    try {
      // Use the authenticated Supabase identity for RLS checks, not cached profile state.
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const authUser = authData.user;
      if (authError || !authUser?.id) throw new Error("Your sign-in session is unavailable. Please log out and sign in again.");
      const { data: createdRoomId, error: inviteError } = await db.rpc("create_study_call_invite", { _friend_id: selectedFriend });
      if (inviteError || !createdRoomId) {
        const detail = inviteError?.message || "The server did not return a call room.";
        if (/permission denied|row-level security|42501/i.test(detail)) throw new Error("The database denied creating the call invitation. Refresh and sign in again. Details: " + detail);
        throw new Error("Could not invite friend: " + detail);
      }
      await connect(createdRoomId);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not start call."); }
    finally { setConnecting(false); }
  };

  const respond = async (invitation: Invitation, accept: boolean) => {
    const { error } = await db.from("study_call_participants").update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
      .eq("room_id", invitation.room_id).eq("user_id", user?.id);
    if (error) { toast.error("Could not respond to invitation: " + error.message); return; }
    setIncoming((old) => old.filter((item) => item.room_id !== invitation.room_id));
    if (accept) await connect(invitation.room_id);
  };

  const leave = async () => {
    const room = roomRef.current;
    if (room) {
      await room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
      await room.localParticipant.setCameraEnabled(false).catch(() => undefined);
      room.disconnect(); roomRef.current = null;
    }
    if (roomId && user) await db.from("study_call_participants").update({ status: "left", responded_at: new Date().toISOString() }).eq("room_id", roomId).eq("user_id", user.id);
    setRoomId(null); setMembers(0); setCameraOn(false); setMuted(false);
    setCallStatus("Call ended");
  };

  useEffect(() => () => { roomRef.current?.disconnect(); document.querySelectorAll("[data-study-call-audio]").forEach(element => element.remove()); }, []);
  const chosenFriend = friends.find(friend => friend.id === selectedFriend);

  return <Card className="bg-white/5 border-white/10 text-white">
    <CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-emerald-300" /> Study Friends</p>
          <p className="text-xs text-white/60">{roomId ? `In call · ${members} participant(s)` : incoming.length ? `${incoming.length} incoming invitation(s)` : "See which friends are online and call them without leaving your timer."}</p></div>
        <Button size="sm" variant="outline" onClick={() => setExpanded(v => !v)}>{expanded ? "Hide" : roomId ? "Call controls" : "Call friends"}</Button>
      </div>
      {incoming.map(invite => <div key={invite.room_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <span className="text-sm">Incoming study call</span><div className="flex gap-2">
          <Button size="sm" onClick={() => void respond(invite, true)}><Check className="mr-1 h-4 w-4" />Accept</Button>
          <Button size="sm" variant="outline" onClick={() => void respond(invite, false)}><X className="mr-1 h-4 w-4" />Decline</Button>
        </div></div>)}
      {expanded && !roomId && <>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/75">Friends online <span className="text-emerald-300">({onlineFriends.length})</span></p>
          <Button size="sm" variant="ghost" onClick={() => void refreshFriends()} disabled={friendsLoading}><RefreshCw className="mr-1 h-3 w-3" />Refresh</Button>
        </div>
        {onlineFriends.length > 0 ? <div className="flex flex-wrap gap-2">
          {onlineFriends.map(friend => <button type="button" key={friend.id} onClick={() => setSelectedFriend(friend.id)} className="rounded-full border border-emerald-300 bg-emerald-400/10 px-3 py-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5"><Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />{displayName(friend)}</span>
          </button>)}
        </div> : <p className="text-xs text-white/55">No friends currently online. Refresh or choose a friend to invite anyway.</p>}
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={selectedFriend} onChange={e => setSelectedFriend(e.target.value)} className="min-w-0 w-full sm:flex-1 min-h-12 rounded-md border border-white/20 bg-slate-900 px-3 py-3 text-base" disabled={!friends.length}>
            <option value="">Choose a friend…</option>{(friends as Friend[]).map(f => <option key={f.id} value={f.id}>{displayName(f)} · {friendPresence[f.id]?.status === "online" ? "Online" : "Offline"}</option>)}
          </select><Button className="w-full sm:w-auto min-h-12" onClick={() => void startCall()} disabled={!selectedFriend || connecting || !chosenFriend}><Phone className="mr-2 h-4 w-4" />{connecting ? "Connecting…" : "Start call"}</Button>
        </div>
      </>}
      {expanded && roomId && <div className="space-y-3"><div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <Button className="min-h-11" size="sm" variant={muted ? "destructive" : "secondary"} onClick={async () => { const next = !muted; try { await roomRef.current?.localParticipant.setMicrophoneEnabled(!next); setMuted(next); } catch { toast.error("Microphone unavailable. Check browser site permissions and device settings."); } }}>{muted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}{muted ? "Unmute" : "Mute"}</Button>
        <Button className="min-h-11" size="sm" variant="outline" onClick={async () => {
          try {
            const next = !cameraOn;
            setDeviceError(null);
            if (next && !navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this browser. Open Master Minds over HTTPS in a supported browser.");
            const activeRoom = roomRef.current;
            if (!activeRoom) throw new Error("The call is no longer connected. Rejoin the call and try again.");
            if (next) {
              // Recover from a stale/unavailable remembered camera by refreshing device access
              // and trying the actual cameras exposed by this browser.
              let cameraStarted = false;
              let lastCameraError: unknown;
              try {
                const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                probe.getTracks().forEach(track => track.stop());
              } catch (permissionError) {
                throw new Error("Camera permission was blocked or no camera is available. Allow camera access for this site and close other apps using the camera.");
              }
              const devices = await navigator.mediaDevices.enumerateDevices();
              const cameras = devices.filter(device => device.kind === "videoinput" && device.deviceId);
              for (const camera of cameras) {
                try {
                  await activeRoom.localParticipant.setCameraEnabled(true, { deviceId: camera.deviceId });
                  cameraStarted = true;
                  break;
                } catch (cameraError) {
                  lastCameraError = cameraError;
                }
              }
              if (!cameraStarted) {
                try {
                  // Let LiveKit/browser choose the current default camera as a final fallback.
                  await activeRoom.localParticipant.setCameraEnabled(true);
                  cameraStarted = true;
                } catch (cameraError) {
                  lastCameraError = cameraError;
                }
              }
              if (!cameraStarted) {
                const detail = lastCameraError instanceof Error ? lastCameraError.message : "";
                throw new Error(detail.includes("Requested device not found")
                  ? "No usable camera was found. Check that your webcam is connected, enabled in Windows, and not being used exclusively by another app."
                  : detail || "Could not start the camera. Check browser permissions and your camera connection.");
              }
            } else {
              await activeRoom.localParticipant.setCameraEnabled(false);
            }
            setCameraOn(next);
            if (next && roomRef.current) {
              const publication = Array.from(roomRef.current.localParticipant.videoTrackPublications.values()).find(item => item.track);
              if (publication?.track) setVideoTracks(current => [...current.filter(item => item.identity !== "You"), { track: publication.track!, identity: "You" }]);
            } else setVideoTracks(current => current.filter(item => item.identity !== "You"));
          } catch (error) {
            const message = error instanceof Error ? error.message : "Camera permission denied or camera unavailable.";
            setDeviceError(message);
            toast.error(message);
          }
        }}>{cameraOn ? <VideoOff className="mr-1 h-4 w-4" /> : <Video className="mr-1 h-4 w-4" />}{cameraOn ? "Camera off" : "Camera on"}</Button>
        <Button className="col-span-2 sm:col-span-1 min-h-11" size="sm" variant="destructive" onClick={() => void leave()}><PhoneOff className="mr-1 h-4 w-4" />Leave call</Button>
      </div>
      <p className="text-xs text-white/70" role="status">{callStatus} · {members} participant{members === 1 ? "" : "s"}</p>
      {deviceError && <p className="text-sm text-amber-200" role="alert">{deviceError}</p>}
      <div ref={videoRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Call video participants">
        {videoTracks.map(({ track, identity }) => <div key={identity} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black">
          <div className="px-3 py-1 text-xs text-white/80 bg-white/10">{identity === "You" ? "You" : identity}</div>
          <div className="aspect-video w-full" ref={node => {
            if (node && !node.hasChildNodes()) {
              const element = track.attach();
              element.className = "block h-full w-full object-cover";
              node.appendChild(element);
            }
          }} />
        </div>)}
        {videoTracks.length === 0 && <div className="rounded-xl border border-dashed border-white/20 p-4 text-center text-sm text-white/60">Camera video is off. Turn on your camera to share video with your study partner.</div>}
      </div></div>}
    </CardContent>
  </Card>;
}
