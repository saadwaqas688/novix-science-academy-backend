-- Class 10 Mathematics: chapter list of the new textbook (National Curriculum 2022-23).
-- Renames existing chapters by number and adds the missing ones. Safe on an empty database.
WITH v(num, t) AS (
  VALUES
    (1, 'Complex Numbers'),
    (2, 'Quadratic Equations'),
    (3, 'Matrices and Determinants'),
    (4, 'Linear and Quadratic Inequalities'),
    (5, 'Algebraic Fractions'),
    (6, 'Functions and Graphs'),
    (7, 'Vectors in Plane'),
    (8, 'Application of Trigonometry'),
    (9, 'Chords and Arcs of a Circle'),
    (10, 'Tangents and Angles of a Circle'),
    (11, 'Practical Geometry of Circles'),
    (12, 'Basic Statistics')
)
UPDATE "chapters" c SET "title" = v.t
FROM v, "subjects" s
WHERE s."slug" = 'math' AND c."subject_id" = s."id" AND c."class_level" = '10' AND c."number" = v.num;
--> statement-breakpoint
INSERT INTO "chapters" ("subject_id", "class_level", "number", "title")
SELECT s."id", '10', v.num, v.t
FROM (VALUES (10, 'Tangents and Angles of a Circle'), (11, 'Practical Geometry of Circles'), (12, 'Basic Statistics')) AS v(num, t)
CROSS JOIN "subjects" s
WHERE s."slug" = 'math'
  AND EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '10')
  AND NOT EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '10' AND x."number" = v.num);
