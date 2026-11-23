-- Class 9 Chemistry: chapter list of the new textbook (National Curriculum 2022-23), 19 units.
-- Renames existing chapters by number and adds the missing ones (9-19).
WITH v(num, t) AS (
  VALUES
    (1, 'Nature of Science in Chemistry'),
    (2, 'Matter'),
    (3, 'Atomic Structure'),
    (4, 'Periodic Table and Periodicity of Properties'),
    (5, 'Chemical Bonding'),
    (6, 'Stoichiometry'),
    (7, 'Electrochemistry'),
    (8, 'Energetics'),
    (9, 'Chemical Equilibrium'),
    (10, 'Acids, Bases and Salts'),
    (11, 'Environmental Chemistry - Air'),
    (12, 'Environmental Chemistry - Water'),
    (13, 'Organic Chemistry'),
    (14, 'Hydrocarbons'),
    (15, 'Biochemistry'),
    (16, 'Empirical Data Collection and Analysis'),
    (17, 'Separation Techniques'),
    (18, 'Qualitative Analysis'),
    (19, 'Chromatography')
)
UPDATE "chapters" c SET "title" = v.t
FROM v, "subjects" s
WHERE s."slug" = 'chemistry' AND c."subject_id" = s."id" AND c."class_level" = '9' AND c."number" = v.num;
--> statement-breakpoint
INSERT INTO "chapters" ("subject_id", "class_level", "number", "title")
SELECT s."id", '9', v.num, v.t
FROM (VALUES (9, 'Chemical Equilibrium'), (10, 'Acids, Bases and Salts'), (11, 'Environmental Chemistry - Air'), (12, 'Environmental Chemistry - Water'), (13, 'Organic Chemistry'), (14, 'Hydrocarbons'), (15, 'Biochemistry'), (16, 'Empirical Data Collection and Analysis'), (17, 'Separation Techniques'), (18, 'Qualitative Analysis'), (19, 'Chromatography')) AS v(num, t)
CROSS JOIN "subjects" s
WHERE s."slug" = 'chemistry'
  AND EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '9')
  AND NOT EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '9' AND x."number" = v.num);
