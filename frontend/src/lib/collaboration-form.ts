export type CollaborationQuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "YES_NO";

export type CollaborationFormQuestion = {
  label: string;
  type: CollaborationQuestionType;
  options: string[];
};
