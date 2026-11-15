import type { OnboardingValues } from '@/features/onboarding/schema';

export type OnboardingStep = {
  field: keyof OnboardingValues;
  title: string;
  subtitle: string;
  options: { label: string; description?: string; value: OnboardingValues[keyof OnboardingValues] }[];
};

export const onboardingSteps: OnboardingStep[] = [
  {
    field: 'currentDistanceMeters',
    title: 'Qual sua distância atual?',
    subtitle: 'A distância que você consegue correr hoje, com conforto.',
    options: [
      { label: '1 km', value: 1000 },
      { label: '3 km', value: 3000 },
      { label: '5 km', value: 5000 },
      { label: '8 km', value: 8000 },
      { label: '10 km ou mais', value: 10000 },
    ],
  },
  {
    field: 'fiveKmTimeSeconds',
    title: 'Quanto tempo você leva nos 5 km?',
    subtitle: 'Uma estimativa já ajuda a montar o ritmo.',
    options: [
      { label: 'Menos de 25 min', value: 22 * 60 },
      { label: '25 a 30 min', value: 27 * 60 },
      { label: '30 a 35 min', value: 32 * 60 },
      { label: '35 a 45 min', value: 40 * 60 },
      { label: 'Mais de 45 min', value: 50 * 60 },
      { label: 'Ainda não corro 5 km', value: 55 * 60 },
    ],
  },
  {
    field: 'weeklyFrequency',
    title: 'Quantas vezes consegue treinar?',
    subtitle: 'Conte só os dias que cabem na sua semana.',
    options: [2, 3, 4, 5, 6].map((days) => ({ label: `${days} vezes por semana`, value: days })),
  },
  {
    field: 'goalDistanceMeters',
    title: 'Qual distância deseja alcançar?',
    subtitle: 'O plano cresce aos poucos até esse objetivo.',
    options: [
      { label: '5 km', value: 5000 },
      { label: '10 km', value: 10000 },
      { label: '15 km', value: 15000 },
      { label: '21 km', value: 21097 },
    ],
  },
  {
    field: 'goalTimeSeconds',
    title: 'Qual seu objetivo de tempo?',
    subtitle: 'O tempo que você quer sustentar nessa distância.',
    options: [
      { label: '25 min', value: 25 * 60 },
      { label: '30 min', value: 30 * 60 },
      { label: '40 min', value: 40 * 60 },
      { label: '50 min', value: 50 * 60 },
      { label: '60 min', value: 60 * 60 },
      { label: 'Mais de 60 min', value: 75 * 60 },
    ],
  },
  {
    field: 'goalHorizonWeeks',
    title: 'Em quanto tempo quer chegar lá?',
    subtitle: 'Um prazo curto demais deixa o plano agressivo.',
    options: [
      { label: '4 semanas', value: 4 },
      { label: '8 semanas', value: 8 },
      { label: '12 semanas', value: 12 },
      { label: '16 semanas', value: 16 },
    ],
  },
  {
    field: 'level',
    title: 'Qual seu nível atual?',
    subtitle: 'Isso define o volume dos tiros e do longão.',
    options: [
      { label: 'Iniciante', description: 'Estou começando ou voltando a correr', value: 'beginner' },
      { label: 'Intermediário', description: 'Já corro com regularidade', value: 'intermediate' },
      { label: 'Avançado', description: 'Treino forte há bastante tempo', value: 'advanced' },
    ],
  },
];
