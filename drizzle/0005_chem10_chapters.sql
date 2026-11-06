-- Class 10 Chemistry: chapter list of the new textbook (National Curriculum 2022-23).
-- Renames existing chapters by number and adds the missing ones. Safe on an empty database.
WITH v(num, t) AS (
  VALUES
    (1, 'History of Chemistry'),
    (2, 'Matter'),
    (3, 'Stoichiometry'),
    (4, 'Electrochemistry'),
    (5, 'Reaction Kinetics'),
    (6, 'Salts'),
    (7, 'Nitrogen, Sulphur and Metals'),
    (8, 'Organic Chemistry'),
    (9, 'Hydrocarbons'),
    (10, 'Hydroxy Compounds'),
    (11, 'Carboxylic Compounds'),
    (12, 'Polymers'),
    (13, 'Biochemistry')
)
UPDATE "chapters" c SET "title" = v.t
FROM v, "subjects" s
WHERE s."slug" = 'chemistry' AND c."subject_id" = s."id" AND c."class_level" = '10' AND c."number" = v.num;
--> statement-breakpoint
INSERT INTO "chapters" ("subject_id", "class_level", "number", "title")
SELECT s."id", '10', v.num, v.t
FROM (VALUES (9, 'Hydrocarbons'), (10, 'Hydroxy Compounds'), (11, 'Carboxylic Compounds'), (12, 'Polymers'), (13, 'Biochemistry')) AS v(num, t)
CROSS JOIN "subjects" s
WHERE s."slug" = 'chemistry'
  AND EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '10')
  AND NOT EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '10' AND x."number" = v.num);
