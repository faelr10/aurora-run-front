import { z } from 'zod';

export const onboardingSchema = z.object({
  age: z.number().int().min(12).max(90),
  weightKg: z.number().min(30).max(250),
  currentDistanceMeters: z.number().positive(),
  currentDurationSeconds: z.number().positive(),
  goalDistanceMeters: z.number().positive(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(8, 'A senha precisa ter 8 caracteres'),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Informe seu nome'),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
