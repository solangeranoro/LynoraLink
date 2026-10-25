import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name is too short").max(80),
    email: z.string().trim().toLowerCase().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    preferredLang: z.enum(["EN", "FR"]).default("EN"),
    age: z.coerce
      .number()
      .int()
      .min(13)
      .max(120)
      .optional()
      .or(z.literal(""))
      .transform((value) => value === "" || value === undefined ? undefined : Number(value)),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    phoneNumber: z.string().trim().max(30).regex(/^[+()\d\s-]*$/).optional().or(z.literal("")),
    handle: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-z0-9_]+$/i, "Handle can only contain letters, numbers and underscores")
      .optional()
      .or(z.literal("")),
    headline: z.string().max(120).optional().or(z.literal("")),
    bio: z.string().max(600).optional().or(z.literal("")),
    skills: z.array(z.string().min(1).max(30)).max(20).default([]),
    githubUrl: z.string().url().optional().or(z.literal("")),
    twitterUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email: z.string().email("Invalid email") });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createProjectSchema = z.object({
  title: z.string().min(3).max(100),
  teamName: z.string().trim().min(3).max(100).optional(),
  tagline: z.string().min(5).max(160),
  description: z.string().min(20).max(5000),
  teamDescription: z.string().trim().min(20).max(5000).optional(),
  teamRules: z.string().trim().max(5000).optional(),
  isPrivate: z.boolean().optional(),
  logoUrl: z.string().max(600_000).optional().or(z.literal("")),
  coverUrl: z.string().max(600_000).optional().or(z.literal("")),
  status: z.enum(["IDEA", "DEVELOPMENT", "LAUNCHED"]).default("IDEA"),
  githubUrl: z.string().url().optional().or(z.literal("")),
  liveUrl: z.string().url().optional().or(z.literal("")),
  docsUrl: z.string().url().optional().or(z.literal("")),
  pitchDeckUrl: z.string().url().optional().or(z.literal("")),
  techStack: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  lookingFor: z.array(z.string()).default([]),
});

export const createTeamSchema = z.object({
  teamName: z.string().trim().min(3).max(100),
  tagline: z.string().trim().min(5).max(160),
  teamDescription: z.string().trim().min(20).max(5000),
  teamRules: z.string().trim().max(5000).optional(),
  isPrivate: z.boolean().optional(),
  logoUrl: z.string().max(600_000).refine(isImageValue).optional().or(z.literal("")),
  lookingFor: z.array(z.enum(["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"])).max(5).default([]),
});

export const updateProjectSchema = z.object({
  title: z.string().trim().min(3).max(100),
  teamName: z.string().trim().min(3).max(100).optional(),
  tagline: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(5000),
  teamDescription: z.string().trim().min(20).max(5000).optional(),
  teamRules: z.string().trim().max(5000).optional(),
  isPrivate: z.boolean().optional(),
  logoUrl: z.string().max(600_000).refine(isImageValue),
  coverUrl: z.string().max(600_000).refine(isImageValue).optional(),
  status: z.enum(["IDEA", "DEVELOPMENT", "LAUNCHED"]),
  githubUrl: z.string().trim().max(300).refine(isWebUrl),
  liveUrl: z.string().trim().max(300).refine(isWebUrl),
  docsUrl: z.string().trim().max(300).refine(isWebUrl).optional(),
  pitchDeckUrl: z.string().trim().max(300).refine(isWebUrl).optional(),
  techStack: z.array(z.string().trim().min(1).max(60)).max(30),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  lookingFor: z.array(z.enum(["CO_BUILDER", "DESIGNER", "MARKETER", "DEVELOPER", "PRODUCT"])).max(5),
});

function isWebUrl(value: string) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isImageValue(value: string) {
  return value === "" || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) || isWebUrl(value);
}

export const createPostSchema = z.object({
  type: z.enum(["PERSONAL", "TEAM", "PROJECT"]).default("PERSONAL"),
  content: z.string().min(1).max(3000),
  codeSnippet: z.string().max(20_000).optional(),
  codeLang: z.string().max(30).optional(),
  imageUrl: z.string().url().max(3_000_000).optional().or(z.literal("")),
  projectId: z.string().cuid().optional(),
  teamId: z.string().cuid().optional(),
  pollQuestion: z.string().trim().min(5).max(180).optional(),
  pollType: z.enum(["OPTIONS", "STAR", "TEXT"]).optional(),
  pollOptions: z.array(z.string().trim().min(1).max(100)).optional(),
  tags: z.array(z.string()).default([]),
}).superRefine((data, context) => {
  if (data.type === "TEAM" && !data.teamId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["teamId"], message: "Team is required for team posts" });
  }
  if (data.type === "TEAM" && data.projectId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["projectId"], message: "Team posts must use teamId" });
  }
  if (data.type === "PROJECT" && !data.projectId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["projectId"], message: "Project is required for project posts" });
  }
  if (data.type === "PERSONAL" && data.teamId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["teamId"], message: "Personal posts cannot use teamId" });
  }
  const pollType = data.pollType ?? "OPTIONS";
  if (Boolean(data.pollQuestion) !== Boolean(data.pollType || data.pollOptions)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Poll question and poll data must be provided together" });
  }
  if (data.pollQuestion && pollType === "OPTIONS" && (!data.pollOptions || data.pollOptions.length < 2 || data.pollOptions.length > 5)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["pollOptions"], message: "Option polls need between two and five options" });
  }
  if (data.pollQuestion && pollType !== "OPTIONS" && data.pollOptions?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["pollOptions"], message: "This poll type does not accept options" });
  }
});

export const updatePostSchema = z.object({
  content: z.string().trim().min(1).max(3000),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  codeSnippet: z.string().max(20_000).optional(),
  imageUrl: z.string().trim().max(3000).refine(isWebUrl).optional(),
  githubUrl: z.string().trim().max(300).refine(isWebUrl).optional(),
  parentId: z.string().cuid().optional(),
});

export const commentReactionSchema = z.object({
  reaction: z.enum(["like", "love", "celebrate", "support", "laugh", "insightful"]),
});

export const reportPostSchema = z.object({
  reason: z.enum(["spam", "harassment", "inappropriate", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export const updatePostPreferenceSchema = z.object({
  preference: z.enum(["saved", "hidden"]),
  enabled: z.boolean(),
});