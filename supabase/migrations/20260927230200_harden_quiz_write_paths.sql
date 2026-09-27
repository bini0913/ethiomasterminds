-- Quiz integrity: finalized quiz data is written only by server-authoritative RPCs.
DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON public.quiz_attempts;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.quiz_attempts FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.quiz_results FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.question_attempts FROM authenticated;

-- Students may read only their own finalized quiz history.
DROP POLICY IF EXISTS "Users can view own quiz results" ON public.quiz_results;
CREATE POLICY "Users can view own quiz results"
ON public.quiz_results
FOR SELECT TO authenticated
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Users can view own question attempts" ON public.question_attempts;
CREATE POLICY "Users can view own question attempts"
ON public.question_attempts
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
