-- Class 10 Physics: chapter list of the new textbook (National Curriculum 2022-23).
-- Book units 10-21 are stored as chapters 1-12. Renames existing chapters by number and adds the missing ones.
WITH v(num, t) AS (
  VALUES
    (1, 'Heat Capacity and Modes of Heat Transfer'),
    (2, 'Thermal Expansion and Change of State'),
    (3, 'Waves'),
    (4, 'Sound'),
    (5, 'Optics'),
    (6, 'Electrostatics'),
    (7, 'Current Electricity'),
    (8, 'Electric Circuits'),
    (9, 'Electronics'),
    (10, 'Electromagnetism'),
    (11, 'Electromagnetic Waves'),
    (12, 'Nuclear Physics')
)
UPDATE "chapters" c SET "title" = v.t
FROM v, "subjects" s
WHERE s."slug" = 'physics' AND c."subject_id" = s."id" AND c."class_level" = '10' AND c."number" = v.num;
--> statement-breakpoint
INSERT INTO "chapters" ("subject_id", "class_level", "number", "title")
SELECT s."id", '10', v.num, v.t
FROM (VALUES (10, 'Electromagnetism'), (11, 'Electromagnetic Waves'), (12, 'Nuclear Physics')) AS v(num, t)
CROSS JOIN "subjects" s
WHERE s."slug" = 'physics'
  AND EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '10')
  AND NOT EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '10' AND x."number" = v.num);
