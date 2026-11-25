import React, { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AIResponseSource = 'ai_tutor' | 'ai_helper';

const reasons = [
  { value: 'inappropriate', label: 'Inappropriate or unsafe content' },
  { value: 'harassment', label: 'Harassment or hateful content' },
  { value: 'violence', label: 'Violence or dangerous advice' },
  { value: 'misinformation', label: 'Incorrect or misleading information' },
  { value: 'privacy', label: 'Personal or private information' },
  { value: 'other', label: 'Other concern' },
];

interface ReportAIResponseButtonProps {
  source: AIResponseSource;
  responseText: string;
  conversationId?: string | null;
}

const ReportAIResponseButton: React.FC<ReportAIResponseButtonProps> = ({
  source,
  responseText,
  conversationId,
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason || !responseText.trim()) {
      toast.error('Choose a reason before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc('submit_ai_response_report', {
        p_source: source,
        p_response_text: responseText.slice(0, 12000),
        p_reason: reason,
        p_description: description.trim().slice(0, 1000) || null,
        p_conversation_id: source === 'ai_tutor' ? conversationId || null : null,
      });
      if (error) throw error;
      toast.success('Report sent to the moderation team.');
      setOpen(false);
      setReason('');
      setDescription('');
    } catch (error: any) {
      console.error('AI response report failed:', error);
      toast.error(error?.message || 'The report could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-muted-foreground" aria-label="Report AI response">
          <Flag className="h-3.5 w-3.5" />
          <span className="text-xs">Report</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this AI response</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Tell the moderation team what is wrong with this response. Your report includes the response text so it can be reviewed.</p>
          <RadioGroup value={reason} onValueChange={setReason}>
            {reasons.map((item) => (
              <div key={item.value} className="flex items-center gap-2">
                <RadioGroupItem value={item.value} id={`ai-report-${source}-${item.value}`} />
                <Label htmlFor={`ai-report-${source}-${item.value}`}>{item.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor={`ai-report-details-${source}`}>Additional details (optional)</Label>
            <Textarea
              id={`ai-report-details-${source}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Add context that may help the review."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={!reason || submitting} onClick={() => void submit()}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : 'Submit report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportAIResponseButton;
