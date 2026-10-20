import { z } from "zod";

const email = z.string().trim().toLowerCase().min(1, "Enter your email").email("Enter a valid email address");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(60, "Keep your name under 60 characters"),
  email,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72, "Use at most 72 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
