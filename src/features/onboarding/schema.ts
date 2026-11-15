import { z } from 'zod';

export const onboardingSchema = z.object({
  currentDistanceMeters: z.number().positive(),
  fiveKmTimeSeconds: z.number().positive(),
  weeklyFrequency: z.number().int().min(2).max(6),
  goalDistanceMeters: z.number().positive(),
  goalTimeSeconds: z.number().positive(),
  goalHorizonWeeks: z.number().int().min(4).max(24),
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
