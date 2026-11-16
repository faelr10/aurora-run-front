import type { OnboardingValues } from '@/features/onboarding/schema';
import type { Level } from '@/types/domain';
import { formatPace } from '@/utils/format';

type ChoiceField = 'age' | 'weightKg' | 'currentDistanceMeters' | 'currentDurationSeconds' | 'goalDistanceMeters' | 'level';

export type ChoiceQuestion = {
  kind: 'choice';
  field: ChoiceField;
  title: string;
  subtitle: string;
  options: { label: string; description?: string; value: number | Level }[];
};

export type PlanQuestion = ChoiceQuestion;

export const planQuestions: PlanQuestion[] = [
  {
    kind: 'choice',
    field: 'age',
    title: 'Qual sua idade?',
    subtitle: 'A idade ajuda a dosar a recuperação entre as etapas.',
    options: [
      { label: '12 a 17 anos', value: 15 },
      { label: '18 a 25 anos', value: 22 },
      { label: '26 a 40 anos', value: 33 },
      { label: '41 a 60 anos', value: 50 },
      { label: '61 a 90 anos', value: 75 },
    ],
  },
  {
    kind: 'choice',
    field: 'weightKg',
    title: 'Qual seu peso?',
    subtitle: 'Usamos o peso só para estimar o esforço, sem transformar isso em dieta.',
    options: [
      { label: '30 a 50 kg', value: 40 },
      { label: '51 a 70 kg', value: 60 },
      { label: '71 a 90 kg', value: 80 },
      { label: '91 a 120 kg', value: 105 },
      { label: '121 a 250 kg', value: 150 },
    ],
  },
  {
    kind: 'choice',
    field: 'currentDistanceMeters',
    title: 'Quantos quilômetros você consegue correr atualmente?',
    subtitle: 'A distância que sai confortável, sem terminar esgotado.',
    options: [
      { label: '0,5 a 2 km', value: 1250 },
      { label: '3 a 5 km', value: 4000 },
      { label: '6 a 10 km', value: 8000 },
      { label: '11 a 20 km', value: 15500 },
      { label: 'Mais de 21 km', value: 25000 },
    ],
  },
  {
    kind: 'choice',
    field: 'currentDurationSeconds',
    title: 'Em quanto tempo você corre essa distância?',
    subtitle: 'Uma estimativa já serve para achar o ritmo.',
    options: [],
  },
  {
    kind: 'choice',
    field: 'goalDistanceMeters',
    title: 'Qual meta em km você quer alcançar?',
    subtitle: 'O longão da última etapa chega perto dessa distância.',
    options: [
      { label: '1 a 5 km', value: 5000 },
      { label: '6 a 10 km', value: 10000 },
      { label: '11 a 21 km', value: 21000 },
      { label: '22 a 42 km', value: 42000 },
      { label: 'Mais de 42 km', value: 50000 },
    ],
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

const PACE_BANDS = [
  { min: 11 * 60 + 30, max: 14 * 60 },
  { min: 9 * 60, max: 11 * 60 },
  { min: 7 * 60 + 15, max: 8 * 60 + 45 },
  { min: 5 * 60 + 45, max: 7 * 60 },
  { min: 4 * 60 + 30, max: 5 * 60 + 30 },
];

export function questionsFor(values: Partial<OnboardingValues>): PlanQuestion[] {
  const meters = values.currentDistanceMeters;
  const distance = planQuestions.find((item) => item.field === 'currentDistanceMeters');
  const band = distance?.options.find((item) => item.value === meters);
  return planQuestions.map((question) => {
    if (question.field !== 'currentDurationSeconds') return question;
    const km = typeof meters === 'number' && meters > 0 ? meters / 1000 : 5;
    const around = km.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return {
      ...question,
      subtitle: band
        ? `Para cerca de ${around} km, dentro da faixa de ${band.label}.`
        : question.subtitle,
      options: durationOptions(km),
    };
  });
}

export function durationLabel(distanceMeters: number, seconds: number): string | null {
  const option = durationOptions(distanceMeters / 1000).find((item) => item.value === seconds);
  return option ? option.label : null;
}

function durationOptions(km: number): ChoiceQuestion['options'] {
  let previous = Number.POSITIVE_INFINITY;
  return PACE_BANDS.map((pace) => {
    const low = Math.max(1, Math.round((km * pace.min) / 60));
    const high = Math.max(low, Math.round((km * pace.max) / 60));
    let mid = Math.round((low + high) / 2);
    if (mid >= previous) mid = previous - 1;
    previous = mid;
    return {
      label: formatSpan(low, high),
      description: `${formatPace(pace.min)} a ${formatPace(pace.max)} por km`,
      value: Math.max(60, mid * 60),
    };
  });
}

function formatSpan(low: number, high: number): string {
  if (low === high) return formatMinutes(low);
  if (high < 60) return `${low} a ${high} min`;
  return `${formatMinutes(low)} a ${formatMinutes(high)}`;
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`;
}

export function rangeLabel(field: 'age' | 'weightKg' | 'currentDistanceMeters' | 'goalDistanceMeters', value: number): string | null {
  const question = planQuestions.find((item) => item.kind === 'choice' && item.field === field);
  if (!question || question.kind !== 'choice') return null;
  const option = question.options.find((item) => item.value === value);
  return option ? option.label : null;
}
