import type { OnboardingValues } from '@/features/onboarding/schema';
import type { Level } from '@/types/domain';

type NumberField = 'age' | 'weightKg' | 'currentDistanceMeters' | 'currentDurationSeconds' | 'goalDistanceMeters';

export type NumberQuestion = {
  kind: 'number';
  field: NumberField;
  title: string;
  subtitle: string;
  unit: string;
  placeholder: string;
  error: string;
  convert: (value: number) => number | null;
  display: (value: number) => string;
};

export type LevelQuestion = {
  kind: 'choice';
  field: 'level';
  title: string;
  subtitle: string;
  options: { label: string; description: string; value: Level }[];
};

export type PlanQuestion = NumberQuestion | LevelQuestion;

export const planQuestions: PlanQuestion[] = [
  {
    kind: 'number',
    field: 'age',
    title: 'Qual sua idade?',
    subtitle: 'A idade ajuda a dosar a recuperação entre as etapas.',
    unit: 'anos',
    placeholder: '30',
    error: 'Informe uma idade entre 12 e 90 anos.',
    convert: (value) => (Number.isInteger(value) && value >= 12 && value <= 90 ? value : null),
    display: (value) => String(value),
  },
  {
    kind: 'number',
    field: 'weightKg',
    title: 'Qual seu peso?',
    subtitle: 'Usamos o peso só para estimar o esforço, sem transformar isso em dieta.',
    unit: 'kg',
    placeholder: '70',
    error: 'Informe um peso entre 30 e 250 kg.',
    convert: (value) => (value >= 30 && value <= 250 ? Math.round(value * 10) / 10 : null),
    display: (value) => String(value),
  },
  {
    kind: 'number',
    field: 'currentDistanceMeters',
    title: 'Quantos km você consegue correr hoje?',
    subtitle: 'A distância que sai confortável, sem terminar esgotado.',
    unit: 'km',
    placeholder: '5',
    error: 'Informe uma distância entre 0,5 e 80 km.',
    convert: (value) => (value >= 0.5 && value <= 80 ? Math.round(value * 1000) : null),
    display: (value) => String(value / 1000),
  },
  {
    kind: 'number',
    field: 'currentDurationSeconds',
    title: 'Em quanto tempo você corre essa distância?',
    subtitle: 'Uma estimativa em minutos já serve para achar o ritmo.',
    unit: 'min',
    placeholder: '32',
    error: 'Informe um tempo entre 1 e 300 minutos.',
    convert: (value) => (value >= 1 && value <= 300 ? Math.round(value * 60) : null),
    display: (value) => String(Math.round(value / 60)),
  },
  {
    kind: 'number',
    field: 'goalDistanceMeters',
    title: 'Qual meta em km você quer alcançar?',
    subtitle: 'O longão da última etapa chega perto dessa distância.',
    unit: 'km',
    placeholder: '10',
    error: 'Informe uma meta entre 1 e 80 km.',
    convert: (value) => (value >= 1 && value <= 80 ? Math.round(value * 1000) : null),
    display: (value) => String(value / 1000),
  },
  {
    kind: 'choice',
    field: 'level',
    title: 'Qual seu nível de experiência com corrida?',
    subtitle: 'Isso define o tamanho dos tiros e o quanto o volume sobe a cada etapa.',
    options: [
      { label: 'Iniciante', description: 'Estou começando ou voltando a correr', value: 'beginner' },
      { label: 'Intermediário', description: 'Já corro com regularidade', value: 'intermediate' },
      { label: 'Avançado', description: 'Treino forte há bastante tempo', value: 'advanced' },
    ],
  },
];

export function answerAt(values: Partial<OnboardingValues>, field: NumberField): number | undefined {
  const value = values[field];
  return typeof value === 'number' ? value : undefined;
}
