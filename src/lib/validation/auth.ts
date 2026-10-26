import { z } from "zod";
import { emailField, passwordField } from "./common";

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(2, "Enter your name.").max(80, "Use 80 characters or fewer."),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
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
