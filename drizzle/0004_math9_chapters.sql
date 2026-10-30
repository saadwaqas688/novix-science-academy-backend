-- Class 9 Mathematics: chapter list of the new textbook (National Curriculum 2022-23).
-- Renames existing chapters by number and adds the missing ones. Safe on an empty database.
WITH v(num, t) AS (
  VALUES
    (1, 'Real Numbers'),
    (2, 'Logarithms'),
    (3, 'Sets and Relations'),
    (4, 'Factorization and Algebraic Manipulation'),
    (5, 'Linear Equations and Inequalities'),
    (6, 'Trigonometry and Bearing'),
    (7, 'Coordinate Geometry'),
    (8, 'Geometry of Straight Lines'),
    (9, 'Geometry and Polygons'),
    (10, 'Practical Geometry'),
    (11, 'Basic Statistics')
)
UPDATE "chapters" c SET "title" = v.t
FROM v, "subjects" s
WHERE s."slug" = 'math' AND c."subject_id" = s."id" AND c."class_level" = '9' AND c."number" = v.num;
--> statement-breakpoint
INSERT INTO "chapters" ("subject_id", "class_level", "number", "title")
SELECT s."id", '9', v.num, v.t
FROM (VALUES (10, 'Practical Geometry'), (11, 'Basic Statistics')) AS v(num, t)
CROSS JOIN "subjects" s
WHERE s."slug" = 'math'
  AND EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '9')
  AND NOT EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '9' AND x."number" = v.num);
