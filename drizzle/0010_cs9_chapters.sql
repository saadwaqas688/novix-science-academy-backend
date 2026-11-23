-- Class 9 Computer Science: chapter list of the new textbook (National Curriculum 2022-23), 7 units.
WITH v(num, t) AS (
  VALUES
    (1, 'Computer Systems'),
    (2, 'Computational Thinking and Algorithms'),
    (3, 'Programming Fundamentals'),
    (4, 'Data and Analysis'),
    (5, 'Applications of Computer Science'),
    (6, 'Impacts of Computing'),
    (7, 'Entrepreneurship')
)
UPDATE "chapters" c SET "title" = v.t
FROM v, "subjects" s
WHERE s."slug" = 'computer' AND c."subject_id" = s."id" AND c."class_level" = '9' AND c."number" = v.num;
--> statement-breakpoint
INSERT INTO "chapters" ("subject_id", "class_level", "number", "title")
SELECT s."id", '9', v.num, v.t
FROM (VALUES (7, 'Entrepreneurship')) AS v(num, t)
CROSS JOIN "subjects" s
WHERE s."slug" = 'computer'
  AND EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '9')
  AND NOT EXISTS (SELECT 1 FROM "chapters" x WHERE x."subject_id" = s."id" AND x."class_level" = '9' AND x."number" = v.num);
