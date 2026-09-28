-- Baseline curriculum bootstrap.
-- Existing curated quizzes are preserved; this fills missing grade/subject/difficulty slots
-- so every supported student can enter the learning loop immediately.

DO $$
DECLARE
  g integer;
  s text;
  d text;
  quiz_title text;
  qid uuid;
  i integer;
  a integer;
  b integer;
  correct text;
  qtext text;
  opts jsonb;
BEGIN
  FOR g IN 1..12 LOOP
    FOR s IN SELECT unnest(ARRAY['Math','Science','English']) LOOP
      FOR d IN SELECT unnest(ARRAY['easy','medium','hard']) LOOP
        quiz_title := format('Master Minds Core - Grade %s - %s - %s', g, s, initcap(d));

        SELECT id INTO qid
        FROM public.quizzes
        WHERE title = quiz_title
        LIMIT 1;

        IF qid IS NULL THEN
          INSERT INTO public.quizzes (
            title, description, subject, grade, difficulty,
            level_min, level_max, created_by, is_approved, is_public, time_limit
          ) VALUES (
            quiz_title,
            format(
              'Baseline %s practice for Grade %s. Use this as a starting point while curated curriculum is expanded.',
              s, g
            ),
            s,
            g::text,
            d,
            CASE d WHEN 'easy' THEN 1 WHEN 'medium' THEN 6 ELSE 11 END,
            CASE d WHEN 'easy' THEN 5 WHEN 'medium' THEN 10 ELSE 20 END,
            gen_random_uuid(),
            true,
            true,
            600
          )
          RETURNING id INTO qid;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.questions WHERE quiz_id = qid) THEN
          FOR i IN 1..10 LOOP
            IF s = 'Math' THEN
              a := g * i + CASE d WHEN 'easy' THEN 1 WHEN 'medium' THEN 7 ELSE 17 END;
              b := i + CASE d WHEN 'easy' THEN g ELSE g + 2 END;
              correct := (a + b)::text;
              qtext := format('What is %s + %s?', a, b);
              opts := jsonb_build_array(
                correct,
                (a + b + 1)::text,
                (a + b - 1)::text,
                (a + b + g + 2)::text
              );
            ELSIF s = 'Science' THEN
              CASE i
                WHEN 1 THEN correct := 'Heart'; qtext := 'Which organ pumps blood around the human body?';
                WHEN 2 THEN correct := 'Water'; qtext := 'Which substance is essential for life and has the formula H2O?';
                WHEN 3 THEN correct := 'Gravity'; qtext := 'What force pulls objects toward Earth?';
                WHEN 4 THEN correct := 'Sun'; qtext := 'What is the main source of energy for Earth?';
                WHEN 5 THEN correct := 'Photosynthesis'; qtext := 'What process allows green plants to make food using light?';
                WHEN 6 THEN correct := 'Cell'; qtext := 'What is the basic structural unit of living things?';
                WHEN 7 THEN correct := 'Oxygen'; qtext := 'Which gas do humans need for normal respiration?';
                WHEN 8 THEN correct := 'Evaporation'; qtext := 'What is the change from liquid water to water vapor called?';
                WHEN 9 THEN correct := 'Ecosystem'; qtext := 'What do we call living organisms and their physical environment together?';
                ELSE correct := 'DNA'; qtext := 'Which molecule carries hereditary information in most living organisms?';
              END CASE;
              opts := jsonb_build_array(correct, 'Moon', 'Carbon dioxide', 'Temperature');
            ELSE
              CASE i
                WHEN 1 THEN correct := 'Noun'; qtext := 'What part of speech names a person, place, thing, or idea?';
                WHEN 2 THEN correct := 'Verb'; qtext := 'What part of speech describes an action or state?';
                WHEN 3 THEN correct := 'Adjective'; qtext := 'What part of speech describes a noun?';
                WHEN 4 THEN correct := 'Adverb'; qtext := 'What part of speech commonly describes how an action is performed?';
                WHEN 5 THEN correct := 'Synonym'; qtext := 'What do we call a word with a similar meaning to another word?';
                WHEN 6 THEN correct := 'Antonym'; qtext := 'What do we call a word with the opposite meaning?';
                WHEN 7 THEN correct := 'Paragraph'; qtext := 'What do we call a group of related sentences about one main idea?';
                WHEN 8 THEN correct := 'Thesis'; qtext := 'What statement usually presents the main claim of an essay?';
                WHEN 9 THEN correct := 'Evidence'; qtext := 'What supports a claim with facts or examples?';
                ELSE correct := 'Conclusion'; qtext := 'What section normally brings an essay to a close?';
              END CASE;
              opts := jsonb_build_array(correct, 'Question', 'Title', 'Number');
            END IF;

            INSERT INTO public.questions (
              quiz_id, question_text, question_type, options,
              option_a, option_b, option_c, option_d,
              correct_answer, explanation, points, order_index,
              difficulty, grade, subject
            ) VALUES (
              qid,
              qtext,
              'multiple_choice',
              opts,
              opts->>0,
              opts->>1,
              opts->>2,
              opts->>3,
              correct,
              format(
                'Review the core %s concept for Grade %s and check each option carefully.',
                lower(s), g
              ),
              CASE d WHEN 'easy' THEN 5 WHEN 'medium' THEN 10 ELSE 15 END,
              i,
              d,
              g::text,
              s
            );
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_quizzes_grade_subject_difficulty_approved
  ON public.quizzes (grade, subject, difficulty, is_approved);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_order
  ON public.questions (quiz_id, order_index);
