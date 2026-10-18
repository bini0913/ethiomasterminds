import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, Check, X, Circle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { useFriends, type FriendPresence } from "@/context/FriendsContext";

declare global {
  interface Window {
    __masterMindsPendingStudyCallRoom?: string;
  }
}

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
  const [outgoingRoomId, setOutgoingRoomId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [members, setMembers] = useState(0);
  const [callStatus, setCallStatus] = useState("Ready to connect");
  const [videoTracks, setVideoTracks] = useState<Array<{ track: Track; identity: string }>>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const roomIdRef = useRef<string | null>(null);
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

  const connect = useCallback(async (id: string, outgoing = false) => {
    if (!user?.id) return;
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
      room.on(RoomEvent.ParticipantConnected, () => {
        setMembers(room.remoteParticipants.size + 1);
        setCallStatus("Friend joined");
        setOutgoingRoomId(null);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setMembers(room.remoteParticipants.size + 1);
        if (room.remoteParticipants.size === 0) setCallStatus("Friend left the call");
      });
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
        roomIdRef.current = null;
        setRoomId(null); setOutgoingRoomId(null); setMembers(0); setCameraOn(false); setCallStatus("Disconnected"); setVideoTracks([]);
        document.querySelectorAll("[data-study-call-audio]").forEach(element => element.remove());
      });
      setCallStatus("Connecting…");
      await room.connect(data.serverUrl, data.token);
      roomRef.current = room;
      try { await room.localParticipant.setMicrophoneEnabled(true); setMuted(false); }
      catch { setMuted(true); toast.error("Call connected, but microphone access was blocked. Allow microphone access in browser site settings."); }
      roomIdRef.current = id;
      setRoomId(id);
      setMembers(room.remoteParticipants.size + 1);
      const hasRemoteParticipant = room.remoteParticipants.size > 0;
      setCallStatus(outgoing && !hasRemoteParticipant ? "Waiting for your friend to answer…" : "Connected");
      if (hasRemoteParticipant) setOutgoingRoomId(null);
      toast.success(outgoing && !hasRemoteParticipant ? "Call started. Waiting for your friend to accept." : "Joined study call. Turn your camera on when ready.");
    } catch (e) {
      setOutgoingRoomId(null);
      setCallStatus("Could not connect");
      toast.error(e instanceof Error ? e.message : "Could not join call.");
    } finally { setConnecting(false); }
  }, [user?.id]);

  useEffect(() => {
    const startAcceptedCall = (roomIdToJoin: string | undefined) => {
      if (!roomIdToJoin || roomId) return;
      if (window.__masterMindsPendingStudyCallRoom === roomIdToJoin) {
        delete window.__masterMindsPendingStudyCallRoom;
      }
      void connect(roomIdToJoin);
    };
    const handler = (event: Event) => {
      const roomIdToJoin = (event as CustomEvent<string>).detail;
      startAcceptedCall(roomIdToJoin);
    };
    window.addEventListener("master-minds-study-call-accepted", handler);
    startAcceptedCall(window.__masterMindsPendingStudyCallRoom);
    return () => window.removeEventListener("master-minds-study-call-accepted", handler);
  }, [connect, roomId]);

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
      setOutgoingRoomId(createdRoomId);
      setCallStatus("Ringing your friend…");
      const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
        body: { kind: "study_call_invite", event_id: createdRoomId },
      });
      if (pushError) console.warn("Study call push could not be sent:", pushError.message);
      await connect(createdRoomId, true);
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

  const leave = useCallback(async (finalStatus = "Call ended") => {
    const activeRoomId = roomIdRef.current ?? roomId;
    const room = roomRef.current;
    if (room) {
      await room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
      await room.localParticipant.setCameraEnabled(false).catch(() => undefined);
      room.disconnect();
      roomRef.current = null;
    }
    if (activeRoomId && user?.id) {
      const { error: participantError } = await db.from("study_call_participants")
        .update({ status: "left", responded_at: new Date().toISOString() })
        .eq("room_id", activeRoomId).eq("user_id", user.id);
      if (participantError) console.warn("Could not update study call participant status:", participantError.message);
      const { error: endError } = await db.rpc("end_study_call_room", { p_room_id: activeRoomId });
      if (endError) console.warn("Could not end study call room:", endError.message);
    }
    roomIdRef.current = null;
    setRoomId(null); setOutgoingRoomId(null); setMembers(0); setCameraOn(false); setMuted(false); setVideoTracks([]);
    setCallStatus(finalStatus);
  }, [roomId, user?.id]);

  useEffect(() => {
    if (!roomId || !user?.id) return;
    const handleParticipantUpdate = (row: Invitation) => {
      if (row.user_id === user.id || row.invited_by !== user.id) return;
      if (row.status === "accepted") setCallStatus("Friend accepted · joining…");
      else if (row.status === "declined") {
        setOutgoingRoomId(null);
        toast.info("Your friend declined the study call.");
        void leave("Friend declined the call");
      } else if (row.status === "expired") {
        setOutgoingRoomId(null);
        toast.info("No answer. The study call invitation expired.");
        void leave("No answer");
      } else if (row.status === "left") setCallStatus("Friend left the call");
    };
    const channel = supabase.channel(`study-call-room-state-${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_call_participants", filter: `room_id=eq.${roomId}` }, payload => handleParticipantUpdate(payload.new as Invitation))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_call_rooms", filter: `id=eq.${roomId}` }, payload => {
        const updatedRoom = payload.new as { ended_at?: string | null };
        if (!updatedRoom.ended_at) return;
        const activeRoom = roomRef.current;
        roomRef.current = null;
        roomIdRef.current = null;
        activeRoom?.disconnect();
        document.querySelectorAll("[data-study-call-audio]").forEach(element => element.remove());
        setRoomId(null); setOutgoingRoomId(null); setMembers(0); setCameraOn(false); setMuted(false); setVideoTracks([]);
        setCallStatus("Call ended");
      }).subscribe();
    void db.from("study_call_participants").select("room_id,user_id,invited_by,status")
      .eq("room_id", roomId).neq("user_id", user.id)
      .then(({ data, error }: { data: Invitation[] | null; error: { message: string } | null }) => {
        if (!error) (data ?? []).forEach(handleParticipantUpdate);
      });
    return () => { void supabase.removeChannel(channel); };
  }, [roomId, user?.id, leave]);

  useEffect(() => {
    if (!outgoingRoomId || roomId !== outgoingRoomId) return;
    const timer = window.setTimeout(async () => {
      const { error } = await db.rpc("expire_study_call_invites", { p_room_id: outgoingRoomId });
      if (error) {
        console.warn("Could not expire unanswered study call:", error.message);
        setCallStatus("Waiting for your friend to answer…");
      }
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [outgoingRoomId, roomId]);

  useEffect(() => {
    const uid = user?.id;
    return () => {
      const activeRoomId = roomIdRef.current;
      if (activeRoomId && uid) {
        void db.from("study_call_participants").update({ status: "left", responded_at: new Date().toISOString() })
          .eq("room_id", activeRoomId).eq("user_id", uid);
        void db.rpc("end_study_call_room", { p_room_id: activeRoomId });
      }
      roomRef.current?.disconnect();
      document.querySelectorAll("[data-study-call-audio]").forEach(element => element.remove());
    };
  }, [user?.id]);
  const chosenFriend = friends.find(friend => friend.id === selectedFriend);

  return <Card className={`overflow-hidden border-white/10 text-white ${roomId ? "bg-slate-950/90 shadow-xl shadow-black/20" : "bg-white/5"}`}>
    <CardContent className={roomId ? "p-0" : "p-4 space-y-3"}>
      <div className={`flex items-center justify-between gap-3 ${roomId ? "border-b border-white/10 bg-slate-900/90 px-4 py-3 sm:px-5" : ""}`}>
        <div className="min-w-0">
          <p className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-emerald-300 shrink-0" />{roomId ? "Study call" : "Study Friends"}</p>
          <p className="text-xs text-white/60">{roomId ? `${callStatus} · ${members} participant${members === 1 ? "" : "s"}` : incoming.length ? `${incoming.length} incoming invitation(s)` : "Study together without leaving your timer."}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 min-h-10" onClick={() => setExpanded(v => !v)}>{roomId ? (expanded ? "Hide video" : "Show video") : (expanded ? "Hide" : "Find friends")}</Button>
      </div>
      <div className={roomId ? "space-y-4 p-3 sm:p-5" : "space-y-3"}>
      {incoming.map(invite => <div key={invite.room_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3">
        <span className="text-sm">Incoming study call</span><div className="flex gap-2">
          <Button className="min-h-10" size="sm" onClick={() => void respond(invite, true)}><Check className="mr-1 h-4 w-4" />Accept</Button>
          <Button className="min-h-10" size="sm" variant="outline" onClick={() => void respond(invite, false)}><X className="mr-1 h-4 w-4" />Decline</Button>
        </div></div>)}
      {expanded && !roomId && <>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white/80">Friends online <span className="text-emerald-300">({onlineFriends.length})</span></p>
          <Button size="sm" variant="ghost" className="min-h-10" onClick={() => void refreshFriends()} disabled={friendsLoading}><RefreshCw className="mr-1 h-3 w-3" />Refresh</Button>
        </div>
        {onlineFriends.length > 0 ? <div className="flex gap-2 overflow-x-auto pb-1">
          {onlineFriends.map(friend => <button type="button" key={friend.id} onClick={() => setSelectedFriend(friend.id)} aria-pressed={selectedFriend === friend.id} className={`shrink-0 rounded-full border px-3 py-2 text-sm transition-colors ${selectedFriend === friend.id ? "border-emerald-300 bg-emerald-400/20 text-white" : "border-white/15 bg-white/5 text-white/75"}`}>
            <span className="inline-flex items-center gap-2"><Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />{displayName(friend)}</span>
          </button>)}
        </div> : <p className="rounded-lg bg-white/5 p-3 text-sm text-white/60">No friends are online right now. You can still invite an offline friend.</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="min-w-0"><span className="mb-1 block text-xs text-white/60">Choose a friend</span>
            <select value={selectedFriend} onChange={e => setSelectedFriend(e.target.value)} className="min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-3 text-base" disabled={!friends.length}>
              <option value="">Choose a friend…</option>{(friends as Friend[]).map(f => <option key={f.id} value={f.id}>{displayName(f)} · {presenceLabel(friendPresence[f.id])}</option>)}
            </select>
          </label>
          <div className="flex items-end"><Button className="min-h-12 w-full sm:w-auto" onClick={() => void startCall()} disabled={!selectedFriend || connecting || !chosenFriend}><Phone className="mr-2 h-4 w-4" />{connecting ? "Connecting…" : "Start call"}</Button></div>
        </div>
      </>}
      {roomId && <>
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-sm font-semibold">{callStatus === "Connected" ? "You're connected" : callStatus}</p><p className="text-xs text-white/60">Keep studying while you talk</p></div>
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200">{members} here</span>
        </div>
        {deviceError && <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100" role="alert">{deviceError}</p>}
        {expanded && <div ref={videoRef} className={`grid gap-3 ${videoTracks.length > 1 ? "grid-cols-2" : "grid-cols-1"}`} aria-label="Call video participants">
          {videoTracks.map(({ track, identity }) => <div key={identity} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg">
            <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-xs text-white/80"><span>{identity === "You" ? "You" : identity}</span><span className="text-emerald-300">● Live</span></div>
            <div className="aspect-video w-full" ref={node => {
              if (node && !node.hasChildNodes()) {
                const element = track.attach();
                element.className = "block h-full w-full object-cover";
                node.appendChild(element);
              }
            }} />
          </div>)}
          {videoTracks.length === 0 && <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 p-5 text-center sm:min-h-48">
            <div className="mb-2 rounded-full bg-white/10 p-3"><Video className="h-6 w-6 text-white/70" /></div>
            <p className="text-sm font-medium">Cameras are off</p><p className="mt-1 max-w-xs text-xs text-white/55">Turn on your camera if you want to see each other. Audio can keep working without video.</p>
          </div>}
        </div>}
        <div data-study-call-controls="true" aria-label="Study call controls" className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-950/95 px-3 pb-3 pt-3 shadow-2xl shadow-black/30 backdrop-blur-md sm:sticky sm:bottom-0 sm:mx-0 sm:max-w-none sm:rounded-none sm:border-x-0 sm:border-b-0 sm:px-5 sm:shadow-none">
          <div className="grid grid-cols-3 gap-2">
            <Button className="min-h-12 flex-col gap-1 sm:flex-row" variant={muted ? "destructive" : "secondary"} onClick={async () => { const next = !muted; try { await roomRef.current?.localParticipant.setMicrophoneEnabled(!next); setMuted(next); } catch { toast.error("Microphone unavailable. Check browser site permissions and device settings."); } }}>{muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}<span className="text-xs sm:text-sm">{muted ? "Unmute" : "Mute"}</span></Button>
            <Button className="min-h-12 flex-col gap-1 sm:flex-row" variant={cameraOn ? "secondary" : "outline"} onClick={async () => {
              try {
                const next = !cameraOn;
                setDeviceError(null);
                if (next && !navigator.mediaDevices?.getUserMedia) {
                  throw new Error("Camera access is unavailable in this browser. Open Master Minds over HTTPS in a supported browser.");
                }
                const activeRoom = roomRef.current;
                if (!activeRoom) throw new Error("The call is no longer connected. Rejoin the call and try again.");

                if (next) {
                  // Request permission first, then enumerate real devices. This avoids reusing
                  // a stale device ID cached by the browser or a previous call session.
                  let probe: MediaStream | undefined;
                  try {
                    probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                  } catch {
                    throw new Error("Camera permission was blocked or no camera is available. Allow camera access for this site and close other apps using the camera.");
                  } finally {
                    probe?.getTracks().forEach(track => track.stop());
                  }

                  const devices = await navigator.mediaDevices.enumerateDevices();
                  const cameras = devices.filter(device => device.kind === "videoinput" && device.deviceId);
                  let cameraStarted = false;
                  let lastCameraError: unknown;

                  for (const camera of cameras) {
                    try {
                      await activeRoom.localParticipant.setCameraEnabled(true, { deviceId: camera.deviceId });
                      cameraStarted = true;
                      break;
                    } catch (cameraError) {
                      lastCameraError = cameraError;
                    }
                  }

                  // Last fallback lets LiveKit/browser pick the current default camera.
                  if (!cameraStarted) {
                    try {
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
                if (next) {
                  const publication = Array.from(activeRoom.localParticipant.videoTrackPublications.values()).find(item => item.track);
                  if (publication?.track) setVideoTracks(current => [...current.filter(item => item.identity !== "You"), { track: publication.track!, identity: "You" }]);
                } else {
                  setVideoTracks(current => current.filter(item => item.identity !== "You"));
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : "Camera permission denied or camera unavailable.";
                setDeviceError(message);
                toast.error(message);
              }
            }}>{cameraOn ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}<span className="text-xs sm:text-sm">{cameraOn ? "Camera off" : "Camera on"}</span></Button>
            <Button className="min-h-12 flex-col gap-1 sm:flex-row" variant="destructive" onClick={() => void leave()}><PhoneOff className="h-4 w-4" /><span className="text-xs sm:text-sm">Leave call</span></Button>
          </div>
        </div>
      </>}
      </div>
    </CardContent>
  </Card>;
}
