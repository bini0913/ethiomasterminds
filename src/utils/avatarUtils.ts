
// Helper function to convert avatar ids to emojis
export function avatarToEmoji(avatarId: string): string {
  const map: {[key: string]: string} = {
    "avatar-1": "👦",
    "avatar-2": "👧",
    "avatar-3": "🧑",
    "avatar-4": "👩‍🎓",
    "avatar-5": "🧠",
    "avatar-6": "🦸",
  };
  return map[avatarId] || "👤";
}
