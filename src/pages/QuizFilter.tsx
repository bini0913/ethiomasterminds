import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Check, Filter, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuiz } from "@/context/QuizContext";

const QuizFilter: React.FC = () => {
  const navigate = useNavigate();
  const { setQuizFilters } = useQuiz();
  
  const [grade, setGrade] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [questionType, setQuestionType] = useState<string>("");
  
  // Available options for filters
  const grades = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const subjects = ["Mathematics", "Science", "English", "Social Studies", "General Knowledge"];
  
  const topics: { [key: string]: string[] } = {
    "Mathematics": ["Numbers", "Algebra", "Geometry", "Fractions", "Decimals", "Percentages"],
    "Science": ["Biology", "Chemistry", "Physics", "Earth Science", "Astronomy"],
    "English": ["Grammar", "Vocabulary", "Reading", "Writing", "Literature"],
    "Social Studies": ["History", "Geography", "Civics", "Economics"],
    "General Knowledge": ["Current Affairs", "Sports", "Arts", "Technology"]
  };
  
  const difficulties = ["Easy", "Medium", "Hard"];
  const questionTypes = ["Multiple Choice", "True/False", "Fill in the Blank", "Matching"];
  
  const applyFilters = () => {
    const filters = {
      grade,
      subject,
      topic,
      difficulty,
      questionType
    };
    
    setQuizFilters(filters);
    navigate("/quiz");
  };
  
  const resetFilters = () => {
    setGrade("");
    setSubject("");
    setTopic("");
    setDifficulty("");
    setQuestionType("");
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary px-4 py-3 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/quiz")}
              className="mr-2 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white">Quiz Filters</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
          >
            Reset Filters
          </Button>
        </div>
      </header>
      
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-primary to-indigo-600 text-white">
              <div className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                <CardTitle>Customize Your Quiz</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade Level</Label>
                    <Select value={grade} onValueChange={setGrade}>
                      <SelectTrigger id="grade">
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((g) => (
                          <SelectItem key={g} value={g}>
                            Grade {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Select value={subject} onValueChange={(value) => {
                      setSubject(value);
                      setTopic(""); // Reset topic when subject changes
                    }}>
                      <SelectTrigger id="subject">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic</Label>
                    <Select value={topic} onValueChange={setTopic} disabled={!subject}>
                      <SelectTrigger id="topic">
                        <SelectValue placeholder={subject ? "Select topic" : "Select a subject first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {subject && topics[subject]?.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty Level</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger id="difficulty">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        {difficulties.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="questionType">Question Type</Label>
                    <Select value={questionType} onValueChange={setQuestionType}>
                      <SelectTrigger id="questionType">
                        <SelectValue placeholder="Select question type" />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((qt) => (
                          <SelectItem key={qt} value={qt}>{qt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="pt-4 space-y-2">
                  <h3 className="text-sm font-medium text-gray-500">Applied Filters:</h3>
                  <div className="flex flex-wrap gap-2">
                    {grade && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300">
                        Grade: {grade}
                      </Badge>
                    )}
                    {subject && (
                      <Badge variant="outline" className="bg-green-50 text-green-800 border-green-300">
                        Subject: {subject}
                      </Badge>
                    )}
                    {topic && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300">
                        Topic: {topic}
                      </Badge>
                    )}
                    {difficulty && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                        Difficulty: {difficulty}
                      </Badge>
                    )}
                    {questionType && (
                      <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">
                        Type: {questionType}
                      </Badge>
                    )}
                    {!grade && !subject && !topic && !difficulty && !questionType && (
                      <span className="text-gray-500 text-sm">No filters applied</span>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end">
                  <Button 
                    onClick={applyFilters}
                    className="bg-primary hover:bg-primary-dark flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Apply Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Need help? Contact support at +251713445505</p>
        </div>
      </div>
    </div>
  );
};

export default QuizFilter;
