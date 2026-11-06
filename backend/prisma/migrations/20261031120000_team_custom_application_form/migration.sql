ALTER TABLE "Project"
ADD COLUMN "collaborationForm" JSONB;

UPDATE "Project"
SET "collaborationForm" = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'label', question,
      'type', 'LONG_TEXT',
      'options', '[]'::jsonb
    )
  )
  FROM unnest("collaborationQuestions") AS question
)
WHERE cardinality("collaborationQuestions") > 0;
