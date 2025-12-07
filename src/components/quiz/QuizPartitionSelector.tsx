import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Star, Check, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizPartition {
  id: string;
  title: string;
  questionCount: number;
  startIndex: number;
  endIndex: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedTime: number; // in minutes
  completed: boolean;
  score?: number;
  locked: boolean;
}

interface QuizPartitionSelectorProps {
  quizTitle: string;
  subject: string;
  grade: number;
  totalQuestions: number;
  partitions: QuizPartition[];
  onSelectPartition: (partition: QuizPartition) => void;
}

const difficultyColors = {
  Easy: 'bg-green-500/20 text-green-500 border-green-500/50',
  Medium: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
  Hard: 'bg-red-500/20 text-red-500 border-red-500/50',
};

const QuizPartitionSelector: React.FC<QuizPartitionSelectorProps> = ({
  quizTitle,
  subject,
  grade,
  totalQuestions,
  partitions,
  onSelectPartition,
}) => {
  const completedCount = partitions.filter((p) => p.completed).length;
  const overallProgress = (completedCount / partitions.length) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 glass neon-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">{quizTitle}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{subject}</Badge>
              <Badge variant="outline">Grade {grade}</Badge>
              <Badge variant="outline">{totalQuestions} Questions</Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Overall Progress</p>
            <p className="text-2xl font-bold text-primary">
              {completedCount}/{partitions.length} Sets
            </p>
            <Progress value={overallProgress} className="h-2 w-32 mt-2" />
          </div>
        </div>
      </Card>

      {/* Partitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {partitions.map((partition, index) => (
          <motion.div
            key={partition.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={cn(
                'p-4 glass transition-all cursor-pointer card-hover',
                partition.completed && 'border-green-500/50',
                partition.locked && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !partition.locked && onSelectPartition(partition)}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center',
                        partition.completed
                          ? 'bg-green-500/20'
                          : partition.locked
                          ? 'bg-muted'
                          : 'bg-primary/20'
                      )}
                    >
                      {partition.completed ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : partition.locked ? (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{partition.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        Questions {partition.startIndex + 1}-{partition.endIndex}
                      </p>
                    </div>
                  </div>
                  <Badge className={difficultyColors[partition.difficulty]}>
                    {partition.difficulty}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span>{partition.questionCount} questions</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>~{partition.estimatedTime} min</span>
                  </div>
                </div>

                {/* Score or Start Button */}
                {partition.completed && partition.score !== undefined ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/10">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-foreground">Score</span>
                    </div>
                    <span className="font-bold text-green-500">{partition.score}%</span>
                  </div>
                ) : !partition.locked ? (
                  <Button className="w-full" size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Start Quiz
                  </Button>
                ) : (
                  <Button className="w-full" size="sm" disabled variant="secondary">
                    <Lock className="h-4 w-4 mr-2" />
                    Complete Previous Set
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <Card className="p-4 glass">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-500/20 flex items-center justify-center">
              <Check className="h-3 w-3 text-green-500" />
            </div>
            <span className="text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-primary/20 flex items-center justify-center">
              <BookOpen className="h-3 w-3 text-primary" />
            </div>
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-muted flex items-center justify-center">
              <Lock className="h-3 w-3 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground">Locked</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default QuizPartitionSelector;

// Helper function to create partitions from questions
export function createQuizPartitions(
  totalQuestions: number,
  questionsPerPartition: number = 10,
  completedPartitions: string[] = []
): QuizPartition[] {
  const partitions: QuizPartition[] = [];
  const numPartitions = Math.ceil(totalQuestions / questionsPerPartition);
  const difficulties: Array<'Easy' | 'Medium' | 'Hard'> = ['Easy', 'Medium', 'Hard'];

  for (let i = 0; i < numPartitions; i++) {
    const startIndex = i * questionsPerPartition;
    const endIndex = Math.min(startIndex + questionsPerPartition, totalQuestions);
    const id = `set-${i + 1}`;
    const isCompleted = completedPartitions.includes(id);
    const isLocked = i > 0 && !completedPartitions.includes(`set-${i}`);

    partitions.push({
      id,
      title: `Set ${i + 1}`,
      questionCount: endIndex - startIndex,
      startIndex,
      endIndex,
      difficulty: difficulties[Math.min(i, difficulties.length - 1)],
      estimatedTime: Math.ceil((endIndex - startIndex) * 0.5),
      completed: isCompleted,
      score: isCompleted ? Math.floor(Math.random() * 30) + 70 : undefined,
      locked: isLocked,
    });
  }

  return partitions;
}
