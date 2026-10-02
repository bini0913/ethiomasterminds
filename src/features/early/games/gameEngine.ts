import type { EarlyGrade } from "../engine/gradeProfile";
import { getGradeProfile } from "../engine/gradeProfile";
import { shuffle } from "../engine/exposure";

export type GameKind = "number" | "word" | "pattern" | "logic" | "science" | "coding" | "clock" | "money" | "fraction" | "map";
export type GameRound = { prompt: string; answer: string; options: string[]; explain: string; visual?: string; skill: string };

const n = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const unique = (xs: string[]) => [...new Set(xs)];
const opts = (answer: string, pool: string[], count: number) =>
  shuffle(unique([answer, ...pool.filter((x) => x !== answer)]).slice(0, count));

export function gradeGameRounds(kind: GameKind, grade: EarlyGrade, count = 6, difficulty = 1): GameRound[] {
  const p = getGradeProfile(grade);
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  const out: GameRound[] = [];

  for (let i = 0; i < count; i++) {
    if (kind === "number") {
      const max = p.numberMax;
      if (grade === 0) {
        const cap = Math.min(10, 4 + d * 2); const a = n(1, cap), b = n(1, cap), answer = a + b;
        out.push({ prompt: "How many altogether?", answer: String(answer), options: opts(String(answer), [String(answer - 1), String(answer + 1), String(answer + 2)], p.choices), explain: `${a} and ${b} make ${answer}.`, visual: "🍎".repeat(a) + "  " + "🍎".repeat(b), skill: "math" });
      } else if (grade === 1) {
        const upper = Math.min(max, 10 + d * 4); const a = n(5, upper), b = n(1, a), answer = a - b;
        out.push({ prompt: `${a} − ${b} = ?`, answer: String(answer), options: opts(String(answer), [String(answer + 1), String(Math.max(0, answer - 1)), String(answer + 2)], p.choices), explain: `Count back ${b} from ${a} to get ${answer}.`, skill: "math" });
      } else if (grade === 2) {
        const a = n(20, Math.min(max, 50 + d * 10)), b = n(10, Math.min(40, 8 + d * 6)), answer = a + b;
        out.push({ prompt: `${a} + ${b} = ?`, answer: String(answer), options: opts(String(answer), [String(answer + 10), String(answer - 10), String(answer + 1)], p.choices), explain: `Add tens and ones: ${a} + ${b} = ${answer}.`, skill: "math" });
      } else if (grade === 3) {
        const a = n(2, Math.min(12, 6 + d)), b = n(2, Math.min(12, 6 + d)), answer = a * b;
        out.push({ prompt: `${a} × ${b} = ?`, answer: String(answer), options: opts(String(answer), [String(answer + b), String(answer - b), String(answer + 10)], p.choices), explain: `${a} groups of ${b} make ${answer}.`, skill: "math" });
      } else {
        const a = n(12, Math.min(80, 30 + d * 12)), b = n(3, Math.min(12, 4 + d * 2)), answer = a * b;
        out.push({ prompt: `${a} × ${b} = ?`, answer: String(answer), options: opts(String(answer), [String(answer + b), String(answer - b), String(answer + 20)], p.choices), explain: `Break the multiplication into tens and ones to check ${answer}.`, skill: "math" });
      }
    } else if (kind === "word") {
      const sets = grade < 2
        ? [["CAT", "DOG", "SUN"], ["FISH", "BOOK", "TREE"], ["MOON", "STAR", "BALL"]]
        : grade === 2
          ? [["HAPPY", "SAD", "FAST"], ["TIGER", "LION", "TABLE"], ["JUMP", "RUN", "BLUE"]]
          : [["BEAUTIFUL", "QUICK", "ANIMAL"], ["GARDEN", "WINDOW", "HUNGRY"], ["ENORMOUS", "TINY", "BRIGHT"]];
      const s = sets[i % sets.length], answer = s[0];
      out.push({ prompt: grade < 2 ? "Which word matches the picture?" : grade === 2 ? "Which word is an animal?" : "Which word best completes the idea?", answer, options: opts(answer, s.slice(1), p.choices), visual: grade < 2 ? ["🐱", "🐶", "☀️"][i % 3] : undefined, explain: grade < 2 ? `${answer} is the word to practise.` : `${answer} is the correct vocabulary choice.`, skill: "reading" });
    } else if (kind === "pattern") {
      const baseStep = grade < 2 ? 2 : grade === 2 ? 5 : grade === 3 ? 3 : 4;
      const step = baseStep + Math.max(0, d - 2);
      const start = n(1, 10), sequence = [start, start + step, start + step * 2], answer = String(start + step * 3);
      out.push({ prompt: `${sequence.join(", ")}, ?`, answer, options: opts(answer, [String(Number(answer) + step), String(Number(answer) - step), String(Number(answer) + 1)], p.choices), explain: `The pattern adds ${step} each time.`, skill: "patterns" });
    } else if (kind === "logic") {
      const a = n(2, 8 + d * 2), b = n(2, 8 + d * 2), answer = String(Math.max(a, b));
      out.push({ prompt: `Which number is greater: ${a} or ${b}?`, answer, options: opts(answer, [String(a), String(b), String(Math.max(1, Math.min(a, b) - 1)), String(Math.max(a, b) + 1)], p.choices), explain: `Compare the numbers: ${answer} is greater.`, skill: "logic" });
    } else if (kind === "science") {
      const sets = grade < 2
        ? [["Sunlight", "Candy", "Smoke"], ["Water", "Sand", "Fire"], ["Bird", "Rock", "Chair"]]
        : grade < 4
          ? [["Heart", "Shoe", "Pencil"], ["Earth", "Mars", "Moon"], ["Oxygen", "Plastic", "Metal"]]
          : [["Heart", "Lungs", "Stomach"], ["Carbon dioxide", "Helium", "Smoke"], ["Herbivore", "Carnivore", "Mineral"]];
      const s = sets[i % sets.length], answer = s[0];
      out.push({ prompt: grade < 2 ? "Which helps a plant grow?" : grade < 4 ? "Which is the correct science answer?" : "Which science word fits best?", answer, options: opts(answer, s.slice(1), p.choices), explain: `${answer} is the key idea to remember.`, skill: "science" });
    } else if (kind === "coding") {
      const moves = grade < 2 ? ["➡️", "➡️", "⬆️"] : grade === 2 ? ["➡️", "⬆️", "➡️"] : grade === 3 ? ["⬆️", "➡️", "➡️", "⬇️"] : ["➡️", "⬆️", "⬆️", "➡️"];
      const answer = moves.join(" ");
      const alternatives = [answer, moves.slice().reverse().join(" "), moves.map((x) => x === "➡️" ? "⬅️" : x).join(" "), moves.map((x) => x === "⬆️" ? "⬇️" : x).join(" ")];
      out.push({ prompt: "Choose the command path that reaches the star.", answer, options: opts(answer, alternatives, p.choices), visual: moves.join(" "), explain: "Follow the arrows in order. Every command is one step.", skill: "sequencing" });
    } else if (kind === "clock") {
      const hour = n(1, 12);
      const minutes = grade < 3 ? (d >= 4 ? [0, 30][i % 2] : 0) : [0, 15, 30, 45][i % 4];
      const answer = `${hour}:${String(minutes).padStart(2, "0")}`;
      out.push({ prompt: "What time is shown?", answer, options: opts(answer, [`${hour === 12 ? 1 : hour + 1}:00`, `${hour}:30`, `${hour}:15`], p.choices), visual: "🕐", explain: `The clock shows ${answer}.`, skill: "time" });
    } else if (kind === "money") {
      const paid = grade < 3 ? (d >= 4 ? 20 : 10) : 20;
      const price = n(1, Math.floor(paid / 5)) * 5;
      const change = paid - price;
      const answer = String(change);
      out.push({ prompt: `A toy costs ${price} coins. You pay ${paid}. Change?`, answer, options: opts(answer, [String(change + 5), String(Math.max(0, change - 5)), String(price)], p.choices), visual: "🪙", explain: `${paid} − ${price} = ${answer} coins back.`, skill: "money" });
    } else if (kind === "fraction") {
      const denominator = grade === 3 ? 2 : 4;
      const numerator = grade === 3 ? 1 : [1, 2, 3][i % 3];
      const answer = `${numerator}/${denominator}`;
      out.push({ prompt: `What fraction is shaded? ${"🟦".repeat(numerator)}${"⬜".repeat(denominator - numerator)}`, answer, options: opts(answer, [`${denominator - numerator}/${denominator}`, `1/${denominator}`, `${numerator + 1}/${denominator}`], p.choices), explain: `There are ${numerator} shaded parts out of ${denominator} equal parts.`, skill: "fractions" });
    } else {
      const places = grade < 3
        ? [["Addis Ababa", "Ethiopia"], ["Nairobi", "Kenya"], ["Cairo", "Egypt"]]
        : [["Addis Ababa", "Ethiopia"], ["Tokyo", "Japan"], ["Paris", "France"]];
      const pair = places[i % places.length];
      out.push({ prompt: `Which country is ${pair[0]} in?`, answer: pair[1], options: opts(pair[1], places.map((x) => x[1]), p.choices), visual: "🗺️", explain: `${pair[0]} is in ${pair[1]}.`, skill: "world" });
    }
  }
  return out;
}

export const GAME_CATALOG: { id: GameKind; title: string; icon: string; description: string; minGrade: EarlyGrade }[] = [
  { id: "number", title: "Number Quest", icon: "🔢", description: "Solve number missions that grow with you.", minGrade: 0 },
  { id: "word", title: "Word Quest", icon: "📚", description: "Build vocabulary and reading confidence.", minGrade: 0 },
  { id: "pattern", title: "Pattern Lab", icon: "🧩", description: "Spot sequences and predict what comes next.", minGrade: 0 },
  { id: "logic", title: "Brain Boost", icon: "🧠", description: "Compare, reason, and solve quick puzzles.", minGrade: 0 },
  { id: "science", title: "Science Safari", icon: "🔬", description: "Answer curious questions about our world.", minGrade: 0 },
  { id: "coding", title: "Code Rocket", icon: "🚀", description: "Plan steps and guide a robot to its goal.", minGrade: 0 },
  { id: "clock", title: "Time Traveler", icon: "⏰", description: "Read clocks and master time.", minGrade: 1 },
  { id: "money", title: "Coin Quest", icon: "🪙", description: "Practise real-world money maths.", minGrade: 1 },
  { id: "fraction", title: "Fraction Pizza", icon: "🍕", description: "See fractions as parts of a whole.", minGrade: 3 },
  { id: "map", title: "World Explorer", icon: "🗺️", description: "Learn places and connections around the world.", minGrade: 2 },
];
