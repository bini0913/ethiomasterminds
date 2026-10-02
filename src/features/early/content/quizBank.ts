import type { EarlyGrade } from "../engine/gradeProfile";
import { shuffle } from "../engine/exposure";

export type QuizSubject = "Math" | "Reading" | "Science" | "World" | "Logic";
export const QUIZ_SUBJECTS: { id: QuizSubject; icon: string; skill: string }[] = [
  { id: "Math", icon: "🔢", skill: "math" },
  { id: "Reading", icon: "📖", skill: "reading" },
  { id: "Science", icon: "🔬", skill: "science" },
  { id: "World", icon: "🌍", skill: "general-knowledge" },
  { id: "Logic", icon: "🧩", skill: "patterns" },
];

export interface QuizItem {
  id: string;
  subject: QuizSubject;
  gradeMin: EarlyGrade;
  gradeMax: EarlyGrade;
  difficulty: 1 | 2 | 3;
  prompt: string;
  options: string[];
  answer: string;
  /** Gentle teaching shown after a wrong answer. */
  explain: string;
}

type Raw = [QuizSubject, number, number, 1 | 2 | 3, string, string[], string, string];
const raw: Raw[] = [
  // Reading
  ["Reading",0,0,1,"Which letter starts 🍎 Apple?",["A","B","M"],"A","Apple begins with the sound /a/, written A."],
  ["Reading",0,0,1,"Which letter starts ☀️ Sun?",["S","T","P"],"S","Sun starts with the /s/ sound, like a snake: sss."],
  ["Reading",0,1,1,"Which word rhymes with CAT?",["HAT","DOG","CUP"],"HAT","Rhymes end the same: c-AT, h-AT."],
  ["Reading",0,1,1,"Which letter starts 🐶 Dog?",["D","B","G"],"D","Dog begins with /d/."],
  ["Reading",1,2,1,"Which word names an animal?",["Tiger","Run","Blue","Happy"],"Tiger","A tiger is an animal. Run is an action, blue is a color."],
  ["Reading",1,2,1,"Which word is spelled correctly?",["Book","Bok","Booc","Buk"],"Book","Book has two O's in the middle: b-o-o-k."],
  ["Reading",1,2,2,"What is the opposite of BIG?",["Small","Tall","Long","Wide"],"Small","Opposites mean very different things: big and small."],
  ["Reading",1,3,2,"Which word has the short 'i' sound like in 'sit'?",["Pig","Bike","Tie","Kite"],"Pig","Pig has a short i. Bike and kite say their name: long i."],
  ["Reading",2,3,2,"Which is a complete sentence?",["The dog runs fast.","The dog.","Runs fast.","Fast dog the."],"The dog runs fast.","A sentence needs who (the dog) and what they do (runs)."],
  ["Reading",2,3,2,"Which word is a verb (action)?",["Jump","Chair","Green","Soft"],"Jump","A verb is something you do. You can jump!"],
  ["Reading",2,4,2,"Plural of 'box' is…",["Boxes","Boxs","Boxen","Boxies"],"Boxes","Words ending in x add -es: box → boxes."],
  ["Reading",3,4,2,"Which word is a noun?",["Garden","Quickly","Run","Bright"],"Garden","A noun is a person, place or thing. A garden is a place."],
  ["Reading",3,4,3,"Which sentence uses correct grammar?",["She runs fast.","She run fast.","She running fast.","She runned fast."],"She runs fast.","With she/he/it we add -s: she runs."],
  ["Reading",3,4,3,"What does 'enormous' mean?",["Very big","Very small","Very fast","Very old"],"Very big","Enormous means huge. An elephant is enormous!"],
  ["Reading",4,4,3,"Which word is an adjective?",["Brave","Bravely","Bravery","Braved"],"Brave","Adjectives describe nouns: a brave lion."],
  ["Reading",4,4,3,"Pick the synonym of 'happy'.",["Joyful","Angry","Tired","Quiet"],"Joyful","Synonyms mean the same: happy and joyful."],
  ["Reading",4,4,3,"Which needs a capital letter?",["addis ababa","apple","table","river"],"addis ababa","Names of places are proper nouns: Addis Ababa."],
  // Science
  ["Science",0,1,1,"Which one can fly?",["🐦 Bird","🐟 Fish","🐢 Turtle"],"🐦 Bird","Birds have wings and feathers to fly."],
  ["Science",0,1,1,"Which animal says meow?",["🐱 Cat","🐶 Dog","🐮 Cow"],"🐱 Cat","Cats meow, dogs bark, cows moo."],
  ["Science",0,1,1,"Which is a living thing?",["🌳 Tree","🪑 Chair","⚽ Ball"],"🌳 Tree","Trees grow, drink water and need sunlight — they are alive."],
  ["Science",1,2,1,"Which is a solid?",["Rock","Water","Air","Steam"],"Rock","Solids keep their shape. Water flows, so it is a liquid."],
  ["Science",1,2,1,"Where does a fish live?",["Water","Tree","Sand","Sky"],"Water","Fish breathe in water using gills."],
  ["Science",1,3,2,"What do plants need to grow?",["Sunlight and water","Candy","Darkness only","Plastic"],"Sunlight and water","Plants make food from sunlight, water and air."],
  ["Science",2,3,2,"Which sense uses your nose?",["Smell","Taste","Touch","Hearing"],"Smell","Your nose helps you smell flowers and food."],
  ["Science",2,4,2,"Water freezes at what °C?",["0","10","50","100"],"0","At 0°C water turns into ice."],
  ["Science",2,4,2,"Which planet do we live on?",["Earth","Mars","Jupiter","Venus"],"Earth","Earth is the third planet from the Sun."],
  ["Science",3,4,2,"Which is a renewable resource?",["Sunlight","Coal","Oil","Gas"],"Sunlight","Renewable means it never runs out. The Sun shines every day."],
  ["Science",3,4,3,"What gas do plants take in?",["Carbon dioxide","Oxygen","Helium","Smoke"],"Carbon dioxide","Plants take in carbon dioxide and give out oxygen for us."],
  ["Science",3,4,3,"Rain falling from clouds is called…",["Precipitation","Evaporation","Condensation","Freezing"],"Precipitation","Precipitation is water falling: rain, snow or hail."],
  ["Science",4,4,3,"Which organ pumps blood?",["Heart","Lungs","Stomach","Brain"],"Heart","Your heart beats about 100,000 times a day!"],
  ["Science",4,4,3,"A magnet attracts…",["Iron nails","Wood","Paper","Plastic"],"Iron nails","Magnets pull on iron and steel."],
  ["Science",4,4,3,"What do we call animals that eat only plants?",["Herbivores","Carnivores","Omnivores","Predators"],"Herbivores","Herbi- means plants. Cows and zebras are herbivores."],
  // World
  ["World",0,1,1,"Which one do we wear on our feet?",["👟 Shoes","🧢 Cap","🧤 Gloves"],"👟 Shoes","Shoes protect our feet."],
  ["World",0,1,1,"What color is grass?",["Green","Purple","Pink"],"Green","Grass is green because of chlorophyll."],
  ["World",1,2,1,"How many days are in a week?",["7","5","10","12"],"7","Monday to Sunday makes 7 days."],
  ["World",1,2,1,"Who helps us when we are sick?",["Doctor","Pilot","Chef","Farmer"],"Doctor","Doctors and nurses help us get better."],
  ["World",2,3,2,"What is the capital city of Ethiopia?",["Addis Ababa","Gondar","Hawassa","Mekelle"],"Addis Ababa","Addis Ababa means 'new flower'."],
  ["World",2,3,2,"How many months are in a year?",["12","10","7","24"],"12","January to December: 12 months."],
  ["World",2,4,2,"Which is the largest ocean?",["Pacific","Atlantic","Indian","Arctic"],"Pacific","The Pacific is bigger than all land put together!"],
  ["World",3,4,2,"Ethiopia is on which continent?",["Africa","Asia","Europe","South America"],"Africa","Ethiopia is in the Horn of Africa."],
  ["World",3,4,3,"The Blue Nile starts from which lake?",["Lake Tana","Lake Victoria","Lake Abaya","Lake Chad"],"Lake Tana","The Blue Nile flows out of Lake Tana in Ethiopia."],
  ["World",4,4,3,"How many continents are there?",["7","5","6","9"],"7","Africa, Asia, Europe, N. America, S. America, Australia, Antarctica."],
  ["World",4,4,3,"Which direction does the Sun rise?",["East","West","North","South"],"East","The Sun rises in the east and sets in the west."],
  // Logic
  ["Logic",0,1,1,"What comes next? 🔴🔵🔴🔵…",["🔴","🔵","🟢"],"🔴","The pattern repeats red, blue, red, blue."],
  ["Logic",0,1,1,"Which shape has 3 sides?",["Triangle","Circle","Square"],"Triangle","Tri means three: a triangle has 3 sides."],
  ["Logic",0,1,1,"Which one is different? 🍎🍎🍌🍎",["🍌","🍎"],"🍌","Three are apples; the banana is the odd one out."],
  ["Logic",1,2,2,"What comes next? 2, 4, 6, …",["8","7","10","9"],"8","We add 2 each time."],
  ["Logic",1,2,2,"Which is heavier?",["Elephant","Mouse","Feather","Leaf"],"Elephant","An elephant can weigh as much as a car!"],
  ["Logic",2,3,2,"What comes next? 5, 10, 15, …",["20","16","25","18"],"20","Counting by 5s: add 5 each time."],
  ["Logic",2,4,2,"If today is Monday, tomorrow is…",["Tuesday","Sunday","Friday","Wednesday"],"Tuesday","After Monday comes Tuesday."],
  ["Logic",3,4,3,"What comes next? 1, 4, 9, 16, …",["25","20","24","32"],"25","These are square numbers: 1×1, 2×2, 3×3, 4×4, 5×5."],
  ["Logic",3,4,3,"A square has how many corners?",["4","3","5","6"],"4","Squares have 4 equal sides and 4 corners."],
  ["Logic",4,4,3,"Tom is taller than Sara. Sara is taller than Ben. Who is shortest?",["Ben","Sara","Tom"],"Ben","Tom > Sara > Ben, so Ben is shortest."],
  ["Logic",4,4,3,"What comes next? 3, 6, 12, 24, …",["48","30","36","27"],"48","Each number doubles."],
];

export const QUIZ_BANK: QuizItem[] = raw.map(([subject, gmin, gmax, d, prompt, options, answer, explain], i) => ({
  id: `${subject.toLowerCase()}-${i}`,
  subject, gradeMin: gmin as EarlyGrade, gradeMax: gmax as EarlyGrade, difficulty: d, prompt, options, answer, explain,
}));

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function distractors(answer: number, count: number, spread: number): string[] {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < count && guard++ < 50) {
    const v = answer + rnd(-spread, spread);
    if (v >= 0) set.add(v);
  }
  return shuffle([...set].map(String));
}

/** Generates a fresh grade-appropriate math question. */
export function generateMath(grade: EarlyGrade, choices: number): QuizItem {
  let prompt = "", answer = 0, explain = "", difficulty: 1 | 2 | 3 = 1;
  const kind = rnd(0, 2);
  if (grade === 0) {
    if (kind === 0) { answer = rnd(1, 8); prompt = `How many stars? ${"⭐".repeat(answer)}`; explain = `Touch each star and count: there are ${answer}.`; }
    else if (kind === 1) { const a = rnd(1, 4), b = rnd(1, 4); answer = a + b; prompt = `${"🍎".repeat(a)} + ${"🍎".repeat(b)} = ?`; explain = `${a} apples and ${b} more make ${answer}.`; }
    else { const a = rnd(1, 9); answer = a + 1; prompt = `What comes after ${a}?`; explain = `Counting up: ${a}, ${answer}.`; }
  } else if (grade === 1) {
    if (kind === 2) { const a = rnd(5, 20), b = rnd(1, a); answer = a - b; prompt = `${a} − ${b} = ?`; explain = `Start at ${a} and count back ${b}: you land on ${answer}.`; }
    else { const a = rnd(1, 10), b = rnd(1, 10); answer = a + b; prompt = `${a} + ${b} = ?`; explain = `Start at ${a} and count on ${b}: ${answer}.`; }
  } else if (grade === 2) {
    difficulty = 2;
    if (kind === 0) { const a = rnd(10, 60), b = rnd(10, 39); answer = a + b; prompt = `${a} + ${b} = ?`; explain = `Add tens, then ones: ${a} + ${b} = ${answer}.`; }
    else if (kind === 1) { const a = rnd(30, 99), b = rnd(10, a); answer = a - b; prompt = `${a} − ${b} = ?`; explain = `Take away tens, then ones: ${answer}.`; }
    else { const s = [2, 5, 10][rnd(0, 2)], start = s * rnd(1, 5); answer = start + s * 3; prompt = `${start}, ${start + s}, ${start + 2 * s}, ?`; explain = `We skip count by ${s}s.`; }
  } else if (grade === 3) {
    difficulty = 2;
    if (kind === 0) { const a = rnd(2, 10), b = rnd(2, 10); answer = a * b; prompt = `${a} × ${b} = ?`; explain = `${a} groups of ${b} make ${answer}.`; }
    else if (kind === 1) { const b = rnd(2, 10), q = rnd(2, 10); answer = q; prompt = `${b * q} ÷ ${b} = ?`; explain = `${b} × ${q} = ${b * q}, so ${b * q} ÷ ${b} = ${q}.`; }
    else { const a = rnd(100, 600), b = rnd(100, 399); answer = a + b; prompt = `${a} + ${b} = ?`; explain = `Add hundreds, tens and ones: ${answer}.`; }
  } else {
    difficulty = 3;
    if (kind === 0) { const a = rnd(12, 99), b = rnd(3, 9); answer = a * b; prompt = `${a} × ${b} = ?`; explain = `${a} × ${b} = (${Math.floor(a / 10) * 10} × ${b}) + (${a % 10} × ${b}) = ${answer}.`; }
    else if (kind === 1) { const b = rnd(3, 9), q = rnd(11, 40); answer = q; prompt = `${b * q} ÷ ${b} = ?`; explain = `Think: ${b} × ? = ${b * q}. The answer is ${q}.`; }
    else { const d = [2, 4, 5, 10][rnd(0, 3)], n = rnd(1, d - 1); answer = n * (100 / d); prompt = `What is ${n}/${d} of 100?`; explain = `100 ÷ ${d} = ${100 / d}, times ${n} = ${answer}.`; }
  }
  const spread = Math.max(3, Math.round(answer * 0.2));
  return { id: `math-gen-${grade}-${prompt}`, subject: "Math", gradeMin: grade, gradeMax: grade, difficulty, prompt, options: distractors(answer, choices, spread), answer: String(answer), explain };
}
