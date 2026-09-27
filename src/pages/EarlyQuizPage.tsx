import React, { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleHelp, Sparkles, Trophy, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useEarlyReward } from "@/hooks/useEarlyReward";
import { useEarlyProgress } from "@/hooks/useEarlyProgress";
import { getUserTier } from "@/lib/getUserTier";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Q = { prompt: string; options: string[]; answer: string; subject: string };
const sets: Record<string, Q[]> = {
  k:[
    {prompt:"Which one is a fruit?",options:["🍎","🚗","🐶","⭐"],answer:"🍎",subject:"Nature"},
    {prompt:"How many dots? • • •",options:["2","3","4","5"],answer:"3",subject:"Numbers"},
    {prompt:"Which letter starts SUN?",options:["S","M","T","B"],answer:"S",subject:"Letters"},
    {prompt:"What animal says meow?",options:["🐱","🐶","🐮","🦁"],answer:"🐱",subject:"Nature"},
    {prompt:"Which shape has 3 sides?",options:["Circle","Triangle","Square","Star"],answer:"Triangle",subject:"Shapes"},
    {prompt:"What comes after 4?",options:["3","5","6","8"],answer:"5",subject:"Numbers"},
    {prompt:"Which is the color of grass?",options:["Green","Purple","Black","Pink"],answer:"Green",subject:"Colors"},
    {prompt:"Which letter comes first in CAT?",options:["C","A","T","B"],answer:"C",subject:"Letters"},
    {prompt:"Which one can fly?",options:["🐦","🐟","🐢","🐄"],answer:"🐦",subject:"Nature"},
    {prompt:"How many sides does a square have?",options:["3","4","5","6"],answer:"4",subject:"Shapes"},
  ],
  g1:[
    {prompt:"What is 3 + 4?",options:["6","7","8","9"],answer:"7",subject:"Math"},
    {prompt:"Which word rhymes with CAT?",options:["DOG","HAT","SUN","PEN"],answer:"HAT",subject:"Reading"},
    {prompt:"Which is a living thing?",options:["Tree","Chair","Ball","Cup"],answer:"Tree",subject:"Science"},
    {prompt:"What comes after 19?",options:["18","20","21","29"],answer:"20",subject:"Math"},
    {prompt:"Which word names an animal?",options:["Run","Blue","Tiger","Happy"],answer:"Tiger",subject:"Reading"},
    {prompt:"What is 8 - 3?",options:["4","5","6","7"],answer:"5",subject:"Math"},
    {prompt:"Which is a solid?",options:["Rock","Water","Air","Steam"],answer:"Rock",subject:"Science"},
    {prompt:"Which word is spelled correctly?",options:["Bok","Book","Booc","Bokke"],answer:"Book",subject:"Reading"},
    {prompt:"What number is greater?",options:["6","9","4","2"],answer:"9",subject:"Math"},
    {prompt:"Which animal lives in water?",options:["Fish","Lion","Horse","Chicken"],answer:"Fish",subject:"Science"},
  ],
  g3:[
    {prompt:"What is 6 × 4?",options:["18","20","24","28"],answer:"24",subject:"Math"},
    {prompt:"Which word is a noun?",options:["Quickly","Garden","Run","Bright"],answer:"Garden",subject:"Reading"},
    {prompt:"Water freezes at what temperature in °C?",options:["0","10","50","100"],answer:"0",subject:"Science"},
    {prompt:"What is 45 ÷ 5?",options:["7","8","9","10"],answer:"9",subject:"Math"},
    {prompt:"Which planet do we live on?",options:["Mars","Earth","Jupiter","Venus"],answer:"Earth",subject:"Science"},
    {prompt:"What is 7 × 8?",options:["48","54","56","64"],answer:"56",subject:"Math"},
    {prompt:"Which sentence is correct?",options:["She run fast.","She runs fast.","She running fast.","She runned fast."],answer:"She runs fast.",subject:"Reading"},
    {prompt:"Which is a renewable resource?",options:["Sunlight","Coal","Oil","Gas"],answer:"Sunlight",subject:"Science"},
    {prompt:"What is 100 - 37?",options:["53","63","67","73"],answer:"63",subject:"Math"},
    {prompt:"Which word means the opposite of 'hot'?",options:["Warm","Cold","Dry","Bright"],answer:"Cold",subject:"Reading"},
  ],
};
