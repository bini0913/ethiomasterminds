import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Flag, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { toast } from 'sonner';

interface ReportButtonProps {
  reportedType: 'post' | 'comment' | 'message' | 'user';
  reportedId: string;
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'default' | 'icon';
}

const reportReasons = [
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'violence', label: 'Violence or threats' },
  { id: 'cheating', label: 'Cheating or unfair play' },
  { id: 'other', label: 'Other' }
];

const ReportButton: React.FC<ReportButtonProps> = ({
  reportedType,
  reportedId,
  variant = 'ghost',
  size = 'sm'
}) => {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) {
      toast.error('Please select a reason');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_type: reportedType,
          reported_id: reportedId,
          reason,
          description: description.trim() || null
        });

      if (error) throw error;

      toast.success('Report submitted. Thank you for helping keep our community safe.');
      setOpen(false);
      setReason('');
      setDescription('');
    } catch (err) {
      console.error('Error submitting report:', err);
      toast.error('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="text-muted-foreground hover:text-destructive">
          <Flag className="h-4 w-4" />
          {size !== 'icon' && <span className="ml-1">Report</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report {reportedType}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Why are you reporting this?</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {reportReasons.map((r) => (
                <div key={r.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.id} id={r.id} />
                  <Label htmlFor={r.id} className="cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium mb-2 block">
              Additional details (optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Provide any additional context that might help us review this report..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Report'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportButton;
