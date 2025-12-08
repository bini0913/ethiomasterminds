import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import Confetti from './Confetti';
import '@/types/speech.d.ts';

interface VoiceAnswerInputProps {
  questionType: 'multiple_choice' | 'true_false' | 'fill_blank';
  options?: string[];
  correctAnswer: string;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  disabled?: boolean;
}

const VoiceAnswerInput: React.FC<VoiceAnswerInputProps> = ({
  questionType,
  options,
  correctAnswer,
  onAnswer,
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; matchedOption: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current];
        const transcriptText = result[0].transcript;
        setTranscript(transcriptText);

        if (result.isFinal) {
          evaluateAnswer(transcriptText);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in this browser');
      return;
    }
    setTranscript('');
    setResult(null);
    setIsListening(true);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const evaluateAnswer = async (spokenText: string) => {
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('voice-evaluate', {
        body: {
          transcribedText: spokenText,
          correctAnswer,
          questionType,
          options,
        },
      });

      if (error) throw error;

      setResult({
        isCorrect: data.isCorrect,
        matchedOption: data.matchedOption,
      });

      if (data.isCorrect) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      onAnswer(data.matchedOption || spokenText, data.isCorrect);
    } catch (error) {
      console.error('Error evaluating voice answer:', error);
      // Fallback to local evaluation
      const normalizedSpoken = spokenText.toLowerCase().trim();
      const normalizedCorrect = correctAnswer.toLowerCase().trim();
      const isCorrect = normalizedSpoken.includes(normalizedCorrect) || 
                       normalizedCorrect.includes(normalizedSpoken);
      
      setResult({ isCorrect, matchedOption: spokenText });
      onAnswer(spokenText, isCorrect);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-4 glass neon-border relative overflow-hidden">
      {showConfetti && <Confetti />}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Voice Answer
          </h4>
          <Badge variant="secondary" className="text-xs">
            {questionType === 'multiple_choice' 
              ? 'Say A, B, C, D or the answer' 
              : questionType === 'true_false'
              ? 'Say True or False'
              : 'Say your answer'}
          </Badge>
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* Mic Button with Animation */}
          <motion.div
            animate={isListening ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: isListening ? Infinity : 0 }}
          >
            <Button
              size="lg"
              onClick={isListening ? stopListening : startListening}
              disabled={disabled || isProcessing}
              className={cn(
                'h-20 w-20 rounded-full',
                isListening
                  ? 'bg-destructive hover:bg-destructive/90 animate-pulse'
                  : 'bg-primary hover:bg-primary/90'
              )}
            >
              {isProcessing ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isListening ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </motion.div>

          {/* Listening Indicator */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 h-4 bg-primary rounded-full"
                      animate={{ scaleY: [1, 2, 1] }}
                      transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">Listening...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transcript Display */}
          {transcript && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <p className="text-sm text-muted-foreground">You said:</p>
              <p className="text-lg font-medium text-foreground">"{transcript}"</p>
            </motion.div>
          )}

          {/* Result Display */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-xl',
                  result.isCorrect
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-destructive/20 text-destructive'
                )}
              >
                {result.isCorrect ? (
                  <>
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Correct!</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5" />
                    <span className="font-medium">Incorrect</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Instructions */}
        <p className="text-xs text-center text-muted-foreground">
          {isListening
            ? 'Speak clearly into your microphone'
            : 'Tap the microphone to answer with your voice'}
        </p>
      </div>
    </Card>
  );
};

export default VoiceAnswerInput;
