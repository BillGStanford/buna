import { z } from "zod";
import { countryField, emailField, passwordField } from "./common";

const founderStatuses = ["founder", "cofounder_seeking", "team_member", "investor", "mentor", "explorer"] as const;
const startupIntents = ["create", "join", "none"] as const;

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(2, "Enter your name.").max(80, "Use 80 characters or fewer."),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    country: countryField,
    founderStatus: z.enum(founderStatuses).or(z.literal("")).transform((v) => (v === "" ? null : v)),
    startupIntent: z.enum(startupIntents).or(z.literal("")).transform((v) => (v === "" ? null : v)),
    acceptTerms: z.literal("on", { errorMap: () => ({ message: "Please accept the Terms, Community Guidelines and Privacy Policy to continue." }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don’t match.",
  });

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password.").max(200),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({ password: passwordField, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don’t match.",
  });
