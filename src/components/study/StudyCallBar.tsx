import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Users, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { useFriends } from "@/context/FriendsContext";

const db = supabase as any;
type Invitation = { room_id: string; user_id: string; invited_by: string; status: string };
type Friend = { id: string; name?: string; username?: string };

export default function StudyCallBar() {
  const { user } = useUser();
  const { friends } = useFriends();
  const [expanded, setExpanded] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState("");
  const [incoming, setIncoming] = useState<Invitation[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [members, setMembers] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

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
    if (!user || connecting) return;
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
      room.on(RoomEvent.TrackSubscribed, (track) => {
        const element = track.attach();
        if (track.kind === Track.Kind.Video && videoRef.current) {
          element.className = "w-full max-w-xs rounded-lg bg-black";
          videoRef.current.appendChild(element);
        } else if (track.kind === Track.Kind.Audio) {
          element.autoplay = true;
          document.body.appendChild(element);
        }
      });
      room.on(RoomEvent.Disconnected, () => { setRoomId(null); setMembers(0); });
      await room.connect(data.serverUrl, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      roomRef.current = room;
      setRoomId(id); setMuted(false); setMembers(room.remoteParticipants.size + 1);
      toast.success("Joined study call. Camera is off until you enable it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join call.");
    } finally { setConnecting(false); }
  };

  const startCall = async () => {
    if (!user || !selectedFriend) { toast.error("Choose a friend first."); return; }
    setConnecting(true);
    try {
      const { data: room, error: roomError } = await db.from("study_call_rooms").insert({ created_by: user.id }).select("id").single();
      if (roomError) throw roomError;
      const { error: selfError } = await db.from("study_call_participants").insert({
        room_id: room.id, user_id: user.id, invited_by: user.id, status: "accepted", responded_at: new Date().toISOString(),
      });
      if (selfError) throw selfError;
      const { error: inviteError } = await db.from("study_call_participants").insert({ room_id: room.id, user_id: selectedFriend, invited_by: user.id, status: "invited" });
      if (inviteError) throw inviteError;
      await connect(room.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not start call."); }
    finally { setConnecting(false); }
  };

  const respond = async (invitation: Invitation, accept: boolean) => {
    const { error } = await db.from("study_call_participants").update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
      .eq("room_id", invitation.room_id).eq("user_id", user?.id);
    if (error) { toast.error(error.message); return; }
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
    videoRef.current?.replaceChildren();
  };

  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  return <Card className="bg-white/5 border-white/10 text-white">
    <CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-emerald-300" /> Study Friends</p>
          <p className="text-xs text-white/60">{roomId ? `In call · ${members} participant(s)` : incoming.length ? `${incoming.length} incoming invitation(s)` : "Call a friend without leaving your study timer."}</p></div>
        <Button size="sm" variant="outline" onClick={() => setExpanded(v => !v)}>{expanded ? "Hide" : roomId ? "Call controls" : "Call friends"}</Button>
      </div>
      {incoming.map(invite => <div key={invite.room_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <span className="text-sm">Incoming study call</span><div className="flex gap-2">
          <Button size="sm" onClick={() => void respond(invite, true)}><Check className="mr-1 h-4 w-4" />Accept</Button>
          <Button size="sm" variant="outline" onClick={() => void respond(invite, false)}><X className="mr-1 h-4 w-4" />Decline</Button>
        </div></div>)}
      {expanded && !roomId && <div className="flex flex-col sm:flex-row gap-2">
        <select value={selectedFriend} onChange={e => setSelectedFriend(e.target.value)} className="min-w-0 flex-1 rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm">
          <option value="">Choose a friend…</option>{(friends as Friend[]).map(f => <option key={f.id} value={f.id}>{f.name || f.username || "Friend"}</option>)}
        </select><Button onClick={() => void startCall()} disabled={!selectedFriend || connecting}><Phone className="mr-2 h-4 w-4" />{connecting ? "Connecting…" : "Start call"}</Button>
      </div>}
      {expanded && roomId && <div className="space-y-3"><div className="flex flex-wrap gap-2">
        <Button size="sm" variant={muted ? "destructive" : "secondary"} onClick={async () => { const next = !muted; await roomRef.current?.localParticipant.setMicrophoneEnabled(!next); setMuted(next); }}>{muted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}{muted ? "Unmute" : "Mute"}</Button>
        <Button size="sm" variant="outline" onClick={async () => { try { const next = !cameraOn; await roomRef.current?.localParticipant.setCameraEnabled(next); setCameraOn(next); } catch { toast.error("Camera permission denied or camera unavailable."); } }}>{cameraOn ? <VideoOff className="mr-1 h-4 w-4" /> : <Video className="mr-1 h-4 w-4" />}{cameraOn ? "Camera off" : "Turn camera on"}</Button>
        <Button size="sm" variant="destructive" onClick={() => void leave()}><PhoneOff className="mr-1 h-4 w-4" />Leave call</Button>
      </div><div ref={videoRef} className="flex flex-wrap gap-2 empty:hidden" aria-label="Call video participants" /></div>}
    </CardContent>
  </Card>;
}
