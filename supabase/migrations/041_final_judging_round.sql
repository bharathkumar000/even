-- ==============================================================================
-- 039_final_judging_round.sql
-- Creates the FINAL JUDGING evaluation round with its 7 criteria
-- ==============================================================================

-- Insert the FINAL JUDGING round
-- Uses the maximum sequence_order + 1 to place it at the end
WITH max_seq AS (
    SELECT COALESCE(MAX(sequence_order), 0) AS max_order FROM public.evaluation_rounds
),
default_event AS (
    SELECT id FROM public.events ORDER BY created_at DESC LIMIT 1
),
inserted_round AS (
    INSERT INTO public.evaluation_rounds (
        event_id,
        title,
        sequence_order,
        status,
        round_type,
        visibility,
        timezone
    )
    SELECT
        e.id,
        'FINAL JUDGING',
        m.max_order + 1,
        'draft',
        'final',
        'published',
        'Asia/Kolkata'
    FROM default_event e, max_seq m
    RETURNING id, title, sequence_order, status
)
-- Insert the 7 criteria for the FINAL JUDGING round
INSERT INTO public.evaluation_criteria (
    round_id,
    title,
    description,
    max_marks,
    is_required
)
SELECT
    r.id,
    c.title,
    c.description,
    c.max_marks,
    true
FROM inserted_round r
CROSS JOIN LATERAL (
    VALUES
        -- 1. Problem Understanding: 5 marks
        ('Problem Understanding',
         'Assess how well the team comprehends the problem statement, including scope, constraints, and stakeholder needs.',
         5),
        -- 2. Problem Definition: 5 marks
        ('Problem Definition',
         'Evaluate clarity and precision in defining the problem, including root cause analysis and success criteria.',
         5),
        -- 3. Ideation Process and Exploration: 10 marks
        ('Ideation Process and Exploration',
         'Assess the breadth and depth of idea generation, exploration of alternatives, and creative thinking demonstrated.',
         10),
        -- 4. Originality and Value of Selected Concept: 10 marks
        ('Originality and Value of Selected Concept',
         'Evaluate the novelty, uniqueness, and potential impact of the chosen solution concept.',
         10),
        -- 5. Impact and Sustainability: 10 marks
        ('Impact and Sustainability',
         'Assess the potential social, environmental, and economic impact, and long-term sustainability of the solution.',
         10),
        -- 6. Economic Feasibility and Viability: 5 marks
        ('Economic Feasibility and Viability',
         'Evaluate cost-effectiveness, business model viability, resource requirements, and financial sustainability.',
         5),
        -- 7. Ideation Roadmap and Video Communication: 5 marks
        ('Ideation Roadmap and Video Communication',
         'Assess the clarity of the implementation roadmap, milestones, and effectiveness of video pitch communication.',
         5)
) AS c(title, description, max_marks);

-- Verification query (for manual verification after migration)
-- SELECT er.title, er.sequence_order, er.status, er.round_type,
--        ec.title as criterion, ec.max_marks, ec.is_required
-- FROM public.evaluation_rounds er
-- JOIN public.evaluation_criteria ec ON ec.round_id = er.id
-- WHERE er.title = 'FINAL JUDGING'
-- ORDER BY ec.max_marks DESC, ec.title;

-- Expected results:
-- FINAL JUDGING | <seq> | draft | final | published | Problem Understanding | 5 | true
-- FINAL JUDGING | <seq> | draft | final | published | Problem Definition | 5 | true
-- FINAL JUDGING | <seq> | draft | final | published | Ideation Process and Exploration | 10 | true
-- FINAL JUDGING | <seq> | draft | final | published | Originality and Value of Selected Concept | 10 | true
-- FINAL JUDGING | <seq> | draft | final | published | Impact and Sustainability | 10 | true
-- FINAL JUDGING | <seq> | draft | final | published | Economic Feasibility and Viability | 5 | true
-- FINAL JUDGING | <seq> | draft | final | published | Ideation Roadmap and Video Communication | 5 | true
-- Total: 50 marks

-- ==============================================================================
-- End of migration
-- ==============================================================================