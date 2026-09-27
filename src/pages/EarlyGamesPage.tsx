import React, { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Gamepad2, Lightbulb, Sparkles, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useEarlyReward } from "@/hooks/useEarlyReward";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type GameId = "number"|"word"|"shape"|"pattern"|"memory"|"odd"|"sort"|"animal"|"builder"|"coding";
type Feedback = "idle"|"correct"|"wrong";


const GameShell:React.FC<{title:string;subtitle:string;icon:React.ReactNode;score:number;children:React.ReactNode}> = ({title,subtitle,icon,score,children}) => (
  <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">{icon}</div><div><h2 className="text-2xl font-display font-bold">{title}</h2><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>
      <Badge variant="secondary" className="rounded-full px-3 py-1"><Sparkles className="mr-1 h-3.5 w-3.5"/>{score}</Badge>
    </div>{children}
  </div>
);

const FeedbackBox:React.FC<{feedback:Feedback}> = ({feedback}) => feedback==="idle"?<div className="min-h-12"/>:(
  <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2 rounded-2xl p-3 font-bold ${feedback==="correct"?"bg-success/15 text-success":"bg-destructive/15 text-destructive"}`}>
    {feedback==="correct"?<><CheckCircle2 className="h-5 w-5"/>Great job!</>:<><XCircle className="h-5 w-5"/>Try the next one!</>}
  </div>
);

const useRoundGame=(onDone:()=>void)=>{
  const {user}=useUser(); const reward=useEarlyReward(); const [round,setRound]=useState(0); const [feedback,setFeedback]=useState<Feedback>("idle"); const [score,setScore]=useState(0);
  const finishChoice=async(correct:boolean)=>{
    if(feedback!=="idle")return;
    setFeedback(correct?"correct":"wrong");
    if(correct){setScore(s=>s+1);if(user?.id)await reward("gameCorrect");}
    window.setTimeout(()=>{setFeedback("idle");if(round>=4)onDone();else setRound(r=>r+1)},650);
  };
  return {round,feedback,score,finishChoice};
};

const NumberQuest:React.FC<{onDone:()=>void}> = ({onDone}) => {
  const {round,feedback,score,finishChoice}=useRoundGame(onDone);
  const question=useMemo(()=>{const a=2+((round*3)%7),b=1+((round*2)%5),answer=a+b;return {text:`What is ${a} + ${b}?`,answer,options:[answer,answer+1,Math.max(1,answer-1),answer+2]}},[round]);
  return <GameShell title="Number Quest" subtitle="Counting and addition adventures." icon={<span className="text-4xl">🔢</span>} score={score}><Prompt text={question.text}/><Options options={question.options.map(String)} onChoose={o=>finishChoice(Number(o)===question.answer)}/><FeedbackBox feedback={feedback}/></GameShell>;
};

const WordMatch:React.FC<{onDone:()=>void}> = ({onDone}) => {
  const rounds=[{emoji:"🐱",answer:"CAT",options:["CAT","SUN","TREE","FISH"]},{emoji:"☀️",answer:"SUN",options:["BOOK","SUN","DOG","MOON"]},{emoji:"🐟",answer:"FISH",options:["FISH","BALL","BIRD","TREE"]},{emoji:"🌳",answer:"TREE",options:["CAR","TREE","STAR","CAT"]},{emoji:"⭐",answer:"STAR",options:["STAR","HOUSE","FISH","SUN"]}];
  const {round,feedback,score,finishChoice}=useRoundGame(onDone); const current=rounds[round];
  return <GameShell title="Word Match" subtitle="Pictures, letters, and early words." icon={<span className="text-4xl">🔤</span>} score={score}><div className="rounded-3xl bg-accent/15 p-7 text-center"><div className="text-7xl">{current.emoji}</div><p className="mt-2 text-sm font-semibold text-muted-foreground">Which word matches?</p></div><Options options={current.options} onChoose={o=>finishChoice(o===current.answer)}/><FeedbackBox feedback={feedback}/></GameShell>;
};

const ShapeHunt:React.FC<{onDone:()=>void}> = ({onDone}) => {
  const rounds=[{target:"Circle",options:["Circle","Square","Triangle","Star"]},{target:"Triangle",options:["Heart","Triangle","Circle","Square"]},{target:"Square",options:["Star","Circle","Square","Triangle"]},{target:"Star",options:["Square","Star","Heart","Circle"]},{target:"Heart",options:["Triangle","Heart","Star","Square"]}];
  const symbols:Record<string,string>={Circle:"●",Triangle:"▲",Square:"■",Star:"★",Heart:"♥"}; const {round,feedback,score,finishChoice}=useRoundGame(onDone); const current=rounds[round];
  return <GameShell title="Shape Hunt" subtitle="Find and name shapes." icon={<span className="text-4xl">🔷</span>} score={score}><div className="rounded-3xl bg-success/10 p-6 text-center"><p className="text-sm font-semibold text-muted-foreground">Find the</p><h2 className="mt-1 text-3xl font-display font-bold">{current.target}</h2></div><div className="grid grid-cols-2 gap-3">{current.options.map(o=><Button key={o} variant="outline" onClick={()=>finishChoice(o===current.target)} className="min-h-24 flex-col gap-1 rounded-3xl"><span className="text-4xl">{symbols[o]}</span><span className="font-semibold">{o}</span></Button>)}</div><FeedbackBox feedback={feedback}/></GameShell>;
};

const PatternBuilder:React.FC<{onDone:()=>void}> = ({onDone}) => {
  const rounds=[{sequence:["🔴","🔵","🔴","🔵","?"],answer:"🔴",options:["🔴","🟢","⭐","🟡"]},{sequence:["⭐","⭐","🌙","⭐","⭐","?"],answer:"🌙",options:["🌙","⭐","☀️","❤️"]},{sequence:["🍎","🍌","🍎","🍌","?"],answer:"🍎",options:["🍎","🍌","🍇","🍊"]},{sequence:["🟩","🟩","🟨","🟩","🟩","?"],answer:"🟨",options:["🟦","🟨","🟥","🟩"]},{sequence:["🐶","🐱","🐭","🐶","🐱","?"],answer:"🐭",options:["🐶","🐱","🐭","🐰"]}]; const {round,feedback,score,finishChoice}=useRoundGame(onDone); const current=rounds[round];
  return <GameShell title="Pattern Builder" subtitle="Look carefully. What comes next?" icon={<span className="text-4xl">🧩</span>} score={score}><div className="rounded-3xl bg-warning/15 p-6 text-center"><div className="flex flex-wrap justify-center gap-2 text-4xl">{current.sequence.map((item,i)=><span key={i} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background shadow-sm">{item}</span>)}</div></div><Options options={current.options} onChoose={o=>finishChoice(o===current.answer)}/><FeedbackBox feedback={feedback}/></GameShell>;
};

const MemoryMatch:React.FC<{onDone:()=>void}> = ({onDone}) => {
  const cards=["🍎","🐶","⭐","🚀","🍎","🐶","⭐","🚀"]; const [flipped,setFlipped]=useState<number[]>([]),[matched,setMatched]=useState<number[]>([]),[locked,setLocked]=useState(false); const {user}=useUser(); const reward=useEarlyReward();
  const tap=(i:number)=>{if(locked||flipped.includes(i)||matched.includes(i))return;const next=[...flipped,i];setFlipped(next);if(next.length!==2)return;setLocked(true);const same=cards[next[0]]===cards[next[1]];window.setTimeout(async()=>{if(same){setMatched(m=>[...m,...next]);if(user?.id)await reward("gameCorrect")}setFlipped([]);setLocked(false);if(same&&matched.length+2===cards.length)onDone()},650)};
  return <GameShell title="Memory Match" subtitle="Find the matching pairs." icon={<span className="text-4xl">🧠</span>} score={matched.length/2}><div className="grid grid-cols-4 gap-2 sm:gap-3">{cards.map((card,i)=>{const visible=flipped.includes(i)||matched.includes(i);return <button key={i} onClick={()=>tap(i)} aria-label={visible?`Card ${i+1}: ${card}`:`Hidden card ${i+1}`} className="aspect-square min-h-16 rounded-2xl border-2 border-border bg-primary/10 text-3xl transition-transform active:scale-95 sm:text-4xl">{visible?card:"?"}</button>})}</div><p className="text-center text-sm font-semibold text-muted-foreground">{matched.length/2} of 4 pairs found</p></GameShell>;
};

const OddOneOut:React.FC<{onDone:()=>void}>=({onDone})=>{
 const rounds=[{items:["🐶","🐱","🐰","🍎"],answer:"🍎"},{items:["🔵","🔵","🔴","🔵"],answer:"🔴"},{items:["🍌","🍎","🍊","🚗"],answer:"🚗"},{items:["⭐","🌙","☀️","🐟"],answer:"🐟"},{items:["2","4","6","7"],answer:"7"}]; const {round,feedback,score,finishChoice}=useRoundGame(onDone);const c=rounds[round];
 return <GameShell title="Odd One Out" subtitle="Which one does not belong?" icon={<span className="text-4xl">🕵️</span>} score={score}><div className="grid grid-cols-2 gap-3">{c.items.map((x,i)=><Button key={i} variant="outline" onClick={()=>finishChoice(x===c.answer)} className="min-h-24 rounded-3xl text-4xl">{x}</Button>)}</div><FeedbackBox feedback={feedback}/></GameShell>;
};

const SortSafari:React.FC<{onDone:()=>void}>=({onDone})=>{
 const rounds=[{prompt:"Which is an animal?",options:["🐶","🍎","🚗","⭐"],answer:"🐶"},{prompt:"Which is food?",options:["🚲","🍌","🐟","🌳"],answer:"🍌"},{prompt:"Which belongs in the sky?",options:["🚀","🐘","🍉","🏠"],answer:"🚀"},{prompt:"Which is a shape?",options:["❤️","🐱","🍓","🐸"],answer:"❤️"},{prompt:"Which can grow?",options:["🌱","🧸","⚽","🚗"],answer:"🌱"}];const {round,feedback,score,finishChoice}=useRoundGame(onDone);const c=rounds[round];
 return <GameShell title="Sort Safari" subtitle="Put each thing in the right group." icon={<span className="text-4xl">🦁</span>} score={score}><Prompt text={c.prompt}/><Options options={c.options} onChoose={o=>finishChoice(o===c.answer)}/><FeedbackBox feedback={feedback}/></GameShell>;
};

const AnimalDetective:React.FC<{onDone:()=>void}>=({onDone})=>{
 const rounds=[{clue:"I have a long trunk.",options:["🐘","🦁","🐸","🐧"],answer:"🐘"},{clue:"I can hop and say ribbit.",options:["🐸","🐯","🐳","🦒"],answer:"🐸"},{clue:"I have black and white stripes.",options:["🦓","🐼","🐊","🦊"],answer:"🦓"},{clue:"I live in the ocean and am very big.",options:["🐋","🐔","🐰","🐿️"],answer:"🐋"},{clue:"I am a tall animal with a very long neck.",options:["🦒","🐢","🐵","🐙"],answer:"🦒"}];const {round,feedback,score,finishChoice}=useRoundGame(onDone);const c=rounds[round];
 return <GameShell title="Animal Detective" subtitle="Use the clue to find the animal." icon={<span className="text-4xl">🔎</span>} score={score}><Prompt text={c.clue}/><Options options={c.options} onChoose={o=>finishChoice(o===c.answer)}/><FeedbackBox feedback={feedback}/></GameShell>;
};

const WordBuilder:React.FC<{onDone:()=>void}>=({onDone})=>{
 const rounds=[{word:"CAT",options:["C","D","M","S"]},{word:"SUN",options:["S","B","T","P"]},{word:"FISH",options:["F","L","R","N"]},{word:"TREE",options:["T","G","P","B"]},{word:"MOON",options:["M","C","D","F"]}];const {round,feedback,score,finishChoice}=useRoundGame(onDone);const c=rounds[round];
 return <GameShell title="Word Builder" subtitle="Find the first letter of the word." icon={<span className="text-4xl">🧱</span>} score={score}><div className="rounded-3xl bg-accent/15 p-6 text-center"><p className="text-sm font-semibold text-muted-foreground">Build this word</p><h2 className="mt-2 text-4xl font-display font-bold">{c.word}</h2></div><Options options={c.options} onChoose={o=>finishChoice(o===c.word[0])}/><FeedbackBox feedback={feedback}/></GameShell>;
};

const CodingRobot:React.FC<{onDone:()=>void}>=({onDone})=>{
 const rounds=[{goal:"Move the robot to the star.",sequence:["➡️","➡️","⭐"],answer:"➡️➡️⭐",options:["➡️➡️⭐","⬅️➡️⭐","⬆️⬆️⭐","➡️⬇️⭐"]},{goal:"Reach the apple.",sequence:["⬆️","➡️","🍎"],answer:"⬆️➡️🍎",options:["⬆️➡️🍎","⬇️➡️🍎","➡️⬆️🍎","⬆️⬅️🍎"]},{goal:"Go to the sun.",sequence:["➡️","⬆️","☀️"],answer:"➡️⬆️☀️",options:["⬅️⬆️☀️","➡️⬆️☀️","➡️⬇️☀️","⬆️➡️☀️"]},{goal:"Find the moon.",sequence:["⬆️","⬆️","🌙"],answer:"⬆️⬆️🌙",options:["⬆️⬇️🌙","⬆️⬆️🌙","➡️⬆️🌙","⬇️⬆️🌙"]},{goal:"Reach the flag.",sequence:["➡️","⬆️","➡️","🚩"],answer:"➡️⬆️➡️🚩",options:["➡️⬆️➡️🚩","⬆️➡️➡️🚩","➡️⬇️➡️🚩","⬅️⬆️➡️🚩"]}];const {round,feedback,score,finishChoice}=useRoundGame(onDone);const c=rounds[round];
 return <GameShell title="Coding Robot" subtitle="Choose the right sequence of commands." icon={<span className="text-4xl">🤖</span>} score={score}><div className="rounded-3xl bg-primary/10 p-6 text-center"><p className="font-semibold">{c.goal}</p><div className="mt-4 flex justify-center gap-2 text-3xl">{c.sequence.map((x,i)=><span key={i} className="rounded-xl bg-background px-3 py-2">{x}</span>)}</div></div><Options options={c.options} onChoose={o=>finishChoice(o===c.answer)}/><FeedbackBox feedback={feedback}/></GameShell>;
};

const Prompt:React.FC<{text:string}>=({text})=><div className="rounded-3xl bg-primary/10 p-6 text-center"><h2 className="text-2xl font-display font-bold">{text}</h2></div>;
const Options:React.FC<{options:string[];onChoose:(value:string)=>void}>=({options,onChoose})=><div className="grid grid-cols-2 gap-3">{options.map(o=><Button key={o} onClick={()=>onChoose(o)} variant="outline" className="min-h-20 rounded-3xl text-xl font-display font-bold">{o}</Button>)}</div>;

const EarlyGamesPage:React.FC=()=>{
 const navigate=useNavigate();const [game,setGame]=useState<GameId|null>(null);const [completed,setCompleted]=useState(0);
 const gameCards=[
  {id:"number" as const,title:"Number Quest",description:"Counting and addition adventures.",icon:"🔢",tone:"bg-primary/10"},
  {id:"word" as const,title:"Word Match",description:"Pictures, letters, and early words.",icon:"🔤",tone:"bg-accent/15"},
  {id:"shape" as const,title:"Shape Hunt",description:"Find and name shapes.",icon:"🔷",tone:"bg-success/15"},
  {id:"pattern" as const,title:"Pattern Builder",description:"Spot what comes next.",icon:"🧩",tone:"bg-warning/15"},
  {id:"memory" as const,title:"Memory Match",description:"Build memory and attention.",icon:"🧠",tone:"bg-primary/10"},
  {id:"odd" as const,title:"Odd One Out",description:"Practice sorting and logic.",icon:"🕵️",tone:"bg-accent/15"},
  {id:"sort" as const,title:"Sort Safari",description:"Group things by what they are.",icon:"🦁",tone:"bg-success/15"},
  {id:"animal" as const,title:"Animal Detective",description:"Learn animals from clues.",icon:"🔎",tone:"bg-warning/15"},
  {id:"builder" as const,title:"Word Builder",description:"Build early spelling skills.",icon:"🧱",tone:"bg-primary/10"},
  {id:"coding" as const,title:"Coding Robot",description:"Practice simple sequences.",icon:"🤖",tone:"bg-accent/15"}
 ];
 const done=()=>setCompleted(n=>n+1);
 return <div className="min-h-screen bg-background pb-24">
  <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><Button variant="ghost" size="icon" aria-label="Back to early home" onClick={()=>navigate("/")}><ArrowLeft/></Button><div className="flex items-center gap-2"><Gamepad2 className="h-6 w-6 text-primary"/><h1 className="font-display text-xl font-bold">Play & Learn</h1></div><Badge variant="secondary">{completed} played</Badge></div></header>
  <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
   {!game?<><section className="rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-lg sm:p-8"><p className="font-semibold opacity-90">Learning through play</p><h2 className="mt-1 text-3xl font-display font-bold">Pick a game!</h2><p className="mt-2 max-w-xl opacity-90">Short activities practise numbers, words, shapes, patterns, memory, logic, nature, language, and sequencing.</p></section><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{gameCards.map(item=><button key={item.id} onClick={()=>setGame(item.id)} className={`min-h-44 rounded-[1.75rem] border border-border p-4 text-left shadow-sm transition hover:-translate-y-1 active:scale-[.98] ${item.tone}`}><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background text-4xl">{item.icon}</div><h3 className="mt-4 font-display text-lg font-bold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></button>)}</div><Card><CardContent className="flex items-center gap-3 p-4"><Lightbulb className="h-5 w-5 text-warning"/><p className="text-sm text-muted-foreground">Each game is a short skill-focused activity with instant feedback and rewards.</p></CardContent></Card></>:<Card className="rounded-[2rem] border-border shadow-sm"><CardContent className="p-4 sm:p-7">
    {game==="number"&&<NumberQuest onDone={()=>{done();setGame(null)}}/>}{game==="word"&&<WordMatch onDone={()=>{done();setGame(null)}}/>}{game==="shape"&&<ShapeHunt onDone={()=>{done();setGame(null)}}/>}{game==="pattern"&&<PatternBuilder onDone={()=>{done();setGame(null)}}/>}{game==="memory"&&<MemoryMatch onDone={()=>{done();setGame(null)}}/>}{game==="odd"&&<OddOneOut onDone={()=>{done();setGame(null)}}/>}{game==="sort"&&<SortSafari onDone={()=>{done();setGame(null)}}/>}{game==="animal"&&<AnimalDetective onDone={()=>{done();setGame(null)}}/>}{game==="builder"&&<WordBuilder onDone={()=>{done();setGame(null)}}/>}{game==="coding"&&<CodingRobot onDone={()=>{done();setGame(null)}}/>}
    <Button variant="ghost" className="mt-4" onClick={()=>setGame(null)}><ArrowLeft className="mr-2 h-4 w-4"/>Choose another game</Button>
   </CardContent></Card>}
  </main>
 </div>;
};
export default EarlyGamesPage;