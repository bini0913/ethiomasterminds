import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CompetitiveUser, createSeedUsers, rankScore } from "@/lib/competitionData";

const USERS_KEY = "mm_competitive_users_v1";
const FOLLOW_KEY = "mm_following_v1";
const SELF_KEY = "mm_self_user_id_v1";

const readUsers = () => {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    const seed = createSeedUsers();
    localStorage.setItem(USERS_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw) as CompetitiveUser[];
};

const readFollowing = () => {
  const raw = localStorage.getItem(FOLLOW_KEY);
  if (!raw) {
    const initial = ["player-2", "player-4", "player-7"];
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(raw) as string[];
};

const readSelfId = (users: CompetitiveUser[]) => {
  const raw = localStorage.getItem(SELF_KEY);
  if (raw) return raw;
  const self = users[6]?.id ?? users[0].id;
  localStorage.setItem(SELF_KEY, self);
  return self;
};

export const useCompetitiveSystem = () => {
  const [users, setUsers] = useState<CompetitiveUser[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [selfId, setSelfId] = useState<string>("");

  useEffect(() => {
    const loadedUsers = readUsers();
    const loadedFollowing = readFollowing();
    const me = readSelfId(loadedUsers);
    setUsers(loadedUsers);
    setFollowing(loadedFollowing);
    setSelfId(me);
  }, []);

  useEffect(() => {
    if (!users.length) return;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(following));
  }, [following]);

  useEffect(() => {
    if (!users.length) return;
    const interval = window.setInterval(() => {
      setUsers((prev) =>
        prev.map((u) => {
          const shouldPulse = Math.random() > 0.62;
          if (!shouldPulse) return u;
          const delta = Math.floor(Math.random() * 24) + 5;
          return {
            ...u,
            xp: u.xp + delta,
            weeklyXp: u.weeklyXp + Math.floor(delta * 0.6),
            level: Math.floor((u.xp + delta) / 220),
          };
        }),
      );
    }, 5000);

    return () => window.clearInterval(interval);
  }, [users.length]);

  const rankedUsers = useMemo(
    () => [...users].sort((a, b) => rankScore(b) - rankScore(a)),
    [users],
  );

  const myProfile = useMemo(() => users.find((u) => u.id === selfId) ?? null, [selfId, users]);

  const followUser = (targetId: string) => {
    if (targetId === selfId || following.includes(targetId)) return;
    setFollowing((prev) => [...prev, targetId]);
    const target = users.find((u) => u.id === targetId);
    toast.success(`${myProfile?.username ?? "You"} started following ${target?.username ?? "user"}`);
  };

  const unfollowUser = (targetId: string) => {
    setFollowing((prev) => prev.filter((id) => id !== targetId));
  };

  const updatePrivacy = (isPublic: boolean, hideStats: boolean) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === selfId ? { ...u, isPublic, hideStats } : u)),
    );
  };

  return {
    users,
    rankedUsers,
    following,
    selfId,
    myProfile,
    setUsers,
    followUser,
    unfollowUser,
    updatePrivacy,
  };
};
