import type { OnboardingValues } from '@/features/onboarding/schema';
import type { DevelopmentPlan, PlanWorkout, PlanWorkoutKind, PlanWorkoutStep } from '@/types/domain';
import { formatPace } from '@/utils/format';

const KINDS: PlanWorkoutKind[] = ['easy', 'intervals', 'long'];

type RawStep = {
  label?: unknown;
  detail?: unknown;
  minutes?: unknown;
  repeats?: unknown;
  recoveryMinutes?: unknown;
  recoverySeconds?: unknown;
  recoveryDetail?: unknown;
  meters?: unknown;
  targetSeconds?: unknown;
};

type RawWorkout = {
  kind?: unknown;
  title?: unknown;
  objective?: unknown;
  distanceMeters?: unknown;
  durationMinutes?: unknown;
  steps?: unknown;
};

type RawStage = {
  title?: unknown;
  focus?: unknown;
  workouts?: unknown;
};

export async function requestDevelopmentPlan(answers: OnboardingValues): Promise<DevelopmentPlan> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error('Falta a chave do ChatGPT. Coloque VITE_OPENAI_API_KEY no arquivo .env e reinicie o app.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: answersPrompt(answers) },
      ],
    }),
  });

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message || 'O ChatGPT não conseguiu montar o plano. Tente de novo.');
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('O ChatGPT devolveu um plano vazio. Tente de novo.');
  return normalizePlan(JSON.parse(content) as { summary?: unknown; stages?: unknown }, answers);
}

const SYSTEM_PROMPT = `Você é um treinador de corrida do Aurora Run. Monte um plano de desenvolvimento e responda apenas com JSON válido, em português do Brasil.

O plano NÃO usa calendário. Não escolha dias da semana, datas, nem diga "segunda" ou "semana de 10 a 16". A pessoa faz os treinos quando conseguir. A ordem é por etapas: ela conclui os 3 treinos da etapa 1 antes da etapa 2.

Cada etapa tem exatamente 3 treinos, nesta ordem:
1. kind "easy": rodagem leve, ritmo de conversa.
2. kind "intervals": treino de qualidade com tiros e descanso explícito.
3. kind "long": longão, o treino mais longo da etapa, mais lento que a rodagem.

Antes de escrever qualquer treino, calcule o ritmo atual em segundos por km: tempo atual dividido pela distância atual em km. Esse número é a referência. Trate-o como uma corrida contínua recente, não como um tiro. Todos os ritmos do plano saem dessa conta. Não copie números de exemplo. Não prescreva um pace que um treinador recusaria para esse histórico.

Como dosar, a partir do ritmo atual:
- Rodagem: 30 a 60 s/km mais lenta. A pessoa precisa conseguir falar frases curtas.
- Longão: 45 a 90 s/km mais lenta, e sempre mais lento que a rodagem da mesma etapa.
- Tiros: só um pouco mais rápidos que o ritmo atual. Iniciante: 5 a 15 s/km mais rápido, em 200 m ou 400 m, de 4 a 6 repetições. Intermediário: 10 a 25 s/km mais rápido, em 400 m ou 600 m. Avançado: 15 a 40 s/km mais rápido, em 400 m, 800 m ou 1000 m. Se a conta ficar mais rápida que isso, aumente o tempo do tiro. Nunca prescreva sprint.
- O descanso existe para repetir o mesmo tempo em todos os tiros. Iniciante: caminhando, com descanso igual ou maior que o tempo do tiro. Intermediário: caminhando ou trote bem leve, entre 60% e 100% do tempo do tiro. Avançado: trote bem leve, nunca menos que 45% do tempo do tiro. Um descanso de 30 segundos só cabe se o próprio tiro durar cerca de 30 a 40 segundos.
- Idade acima de 50 anos e pouco experiência pedem menos tiros e descanso mais longo. O peso não muda o pace. Não dê conselho médico, dieta ou diagnóstico.
- Suba o volume de 5% a 10% entre etapas. A rodagem é mais curta que o longão. O longão da última etapa fica perto da meta, sem ultrapassá-la. Se a meta for parecida com a distância atual, consolide o ritmo em vez de inflar o volume. Crie de 4 a 8 etapas.

A timeline de cada treino tem de ser executável do primeiro ao último segundo. Cada passo diz o que fazer, por quanto tempo ou quantos metros, e em que ritmo. Aquecimento e desaquecimento são passos. O treino tem de 3 a 6 passos no JSON. Não quebre cada repetição em um passo separado: use "repeats". O aplicativo abre a timeline sozinho, um tiro e um descanso por vez.

No passo de tiro, estes campos são obrigatórios e têm de bater com o texto:
- "meters": distância de UM tiro.
- "targetSeconds": tempo alvo de UM tiro. O pace em min/km desse tempo precisa cair na faixa acima.
- "repeats": quantas vezes.
- "recoverySeconds": segundos de descanso entre os tiros.
- "recoveryDetail": somente "caminhando" ou "trote bem leve".
- "detail": a frase que a pessoa lê, no formato "Corra 400 m em 2:15. Depois caminhe 1 minuto e 30 segundos." Os números do texto têm de ser os mesmos de meters, targetSeconds e recoverySeconds.

Na rodagem e no longão, o passo principal leva "meters" e "targetSeconds" daquele bloco contínuo, e o "detail" diz a distância e o pace em min/km. O aquecimento e o desaquecimento dizem se é caminhada ou trote e por quantos minutos.

"minutes" é a duração de uma repetição, arredondada para cima. "durationMinutes" soma a sessão inteira, com os descansos. "distanceMeters" é a distância da sessão inteira. Títulos curtos. O objetivo é uma frase.

Os números abaixo são só o formato do JSON. Não use 400 m, 2:15 nem 90 segundos se a conta do atleta pedir outro tiro.
{
  "summary": "uma ou duas frases sobre o caminho até a meta",
  "stages": [
    {
      "title": "nome curto da etapa",
      "focus": "o que essa etapa desenvolve",
      "workouts": [
        {
          "kind": "intervals",
          "title": "Tiros curtos",
          "objective": "Correr forte e controlado, recuperando o suficiente para repetir o tempo.",
          "distanceMeters": 4200,
          "durationMinutes": 28,
          "steps": [
            { "label": "Aquecimento", "detail": "Trote bem leve por 8 minutos, sem pressa.", "minutes": 8 },
            { "label": "Tiro", "detail": "Corra 400 m em 2:15. Depois caminhe 1 minuto e 30 segundos.", "minutes": 3, "repeats": 5, "meters": 400, "targetSeconds": 135, "recoverySeconds": 90, "recoveryDetail": "caminhando" },
            { "label": "Desaquecimento", "detail": "Caminhe 5 minutos até a respiração baixar.", "minutes": 5 }
          ]
        }
      ]
    }
  ]
}`;

function answersPrompt(answers: OnboardingValues): string {
  const km = (meters: number) => (meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const minutes = Math.round(answers.currentDurationSeconds / 60);
  const pace = formatPace(answers.currentDurationSeconds / (answers.currentDistanceMeters / 1000));
  const level = answers.level === 'beginner' ? 'iniciante' : answers.level === 'advanced' ? 'avançado' : 'intermediário';
  return [
    `Idade: ${answers.age} anos.`,
    `Peso: ${answers.weightKg} kg.`,
    `Consegue correr hoje: ${km(answers.currentDistanceMeters)} km em cerca de ${minutes} minutos.`,
    `Ritmo atual dessa corrida: ${pace} min/km. Calcule de novo e use este número como base de todos os paces.`,
    `Meta: ${km(answers.goalDistanceMeters)} km.`,
    `Nível de experiência: ${level}.`,
    'Monte a timeline completa de cada treino. No tiro, escreva a distância, o tempo e o descanso em segundos, dizendo se é caminhando ou trote bem leve. Os números precisam ser coerentes com o ritmo atual. Não copie o exemplo do formato.',
  ].join('\n');
}

function normalizePlan(raw: { summary?: unknown; stages?: unknown }, answers: OnboardingValues): DevelopmentPlan {
  if (!Array.isArray(raw.stages) || raw.stages.length < 4 || raw.stages.length > 8) {
    throw new Error('O plano não veio com etapas suficientes. Tente de novo.');
  }
  const athlete = {
    paceSecondsPerKm: answers.currentDurationSeconds / (answers.currentDistanceMeters / 1000),
    level: answers.level,
  };
  const stages = raw.stages.map((item, stageIndex) => normalizeStage(item as RawStage, stageIndex, athlete));
  const summary = text(raw.summary);
  if (!summary) throw new Error('O plano veio sem um resumo. Tente de novo.');
  return { summary, stages };
}

function normalizeStage(raw: RawStage, stageIndex: number, athlete: Athlete) {
  const title = text(raw.title);
  const focus = text(raw.focus);
  if (!title || !focus || !Array.isArray(raw.workouts)) {
    throw new Error('Uma etapa do plano veio incompleta. Tente de novo.');
  }
  const byKind = new Map<PlanWorkoutKind, PlanWorkout>();
  for (const item of raw.workouts) {
    const workout = normalizeWorkout(item as RawWorkout, stageIndex, athlete);
    if (workout) byKind.set(workout.kind, workout);
  }
  const workouts = KINDS.map((kind) => byKind.get(kind)).filter((item): item is PlanWorkout => Boolean(item));
  if (workouts.length !== 3) throw new Error('Cada etapa precisa ter rodagem, tiros e longão. Tente de novo.');
  return { id: `etapa-${stageIndex + 1}`, title, focus, workouts };
}

type Athlete = { paceSecondsPerKm: number; level: OnboardingValues['level'] };

function normalizeWorkout(raw: RawWorkout, stageIndex: number, athlete: Athlete): PlanWorkout | null {
  if (raw.kind !== 'easy' && raw.kind !== 'intervals' && raw.kind !== 'long') return null;
  const title = text(raw.title);
  const objective = text(raw.objective);
  const steps = Array.isArray(raw.steps) ? raw.steps.map((item) => normalizeStep(item as RawStep)).filter((item): item is PlanWorkoutStep => Boolean(item)) : [];
  const durationMinutes = numberValue(raw.durationMinutes);
  if (!title || !objective || !durationMinutes || steps.length === 0) return null;
  if (raw.kind === 'intervals') assertIntervals(steps, athlete);
  if (raw.kind !== 'intervals') assertContinuous(steps, athlete, raw.kind);
  const distanceMeters = numberValue(raw.distanceMeters);
  return {
    id: `etapa-${stageIndex + 1}-${raw.kind}`,
    kind: raw.kind,
    title,
    objective,
    distanceMeters: distanceMeters ? Math.round(distanceMeters) : null,
    durationMinutes: Math.round(durationMinutes),
    steps,
    completedOn: null,
  };
}

function normalizeStep(raw: RawStep): PlanWorkoutStep | null {
  const label = text(raw.label);
  const detail = text(raw.detail);
  const meters = numberValue(raw.meters);
  const targetSeconds = numberValue(raw.targetSeconds);
  const minutes = numberValue(raw.minutes) ?? (targetSeconds ? targetSeconds / 60 : null);
  if (!label || !detail || !minutes) return null;
  const repeats = numberValue(raw.repeats);
  const recoveryMinutes = numberValue(raw.recoveryMinutes);
  const recoverySeconds = numberValue(raw.recoverySeconds) ?? (recoveryMinutes ? recoveryMinutes * 60 : null);
  const recoveryDetail = text(raw.recoveryDetail);
  return {
    label,
    detail,
    minutes: Math.max(1, Math.round(minutes)),
    ...(repeats && repeats > 1 ? { repeats: Math.round(repeats) } : {}),
    ...(recoveryMinutes ? { recoveryMinutes: Math.round(recoveryMinutes) } : {}),
    ...(recoverySeconds ? { recoverySeconds: Math.round(recoverySeconds) } : {}),
    ...(recoveryDetail ? { recoveryDetail } : {}),
    ...(meters ? { meters: Math.round(meters) } : {}),
    ...(targetSeconds ? { targetSeconds: Math.round(targetSeconds) } : {}),
  };
}

function assertIntervals(steps: PlanWorkoutStep[], athlete: Athlete) {
  const work = steps.find((step) => step.meters && step.targetSeconds && (step.repeats ?? 1) > 1);
  if (!work?.meters || !work.targetSeconds) throw new Error('Os tiros vieram sem distância e tempo. Tente de novo.');
  if (!work.recoverySeconds) throw new Error('Os tiros vieram sem o descanso. Tente de novo.');
  const repPace = work.targetSeconds / (work.meters / 1000);
  const fastest = athlete.level === 'beginner' ? 20 : athlete.level === 'advanced' ? 50 : 35;
  if (repPace < athlete.paceSecondsPerKm - fastest) {
    throw new Error('O ritmo dos tiros ficou rápido demais para o que você corre hoje. Tente de novo.');
  }
  if (repPace > athlete.paceSecondsPerKm + 30) {
    throw new Error('Os tiros ficaram lentos demais para um treino de qualidade. Tente de novo.');
  }
  const minimumRest = athlete.level === 'beginner' ? work.targetSeconds : Math.round(work.targetSeconds * (athlete.level === 'advanced' ? 0.45 : 0.6));
  if (work.recoverySeconds < minimumRest) throw new Error('O descanso entre os tiros ficou curto demais. Tente de novo.');
  if (!work.recoveryDetail) work.recoveryDetail = athlete.level === 'advanced' ? 'trote bem leve' : 'caminhando';
}

function assertContinuous(steps: PlanWorkoutStep[], athlete: Athlete, kind: 'easy' | 'long') {
  const main = steps.reduce<PlanWorkoutStep | null>((best, step) => ((step.meters ?? 0) > (best?.meters ?? 0) ? step : best), null);
  if (!main?.meters) throw new Error(kind === 'long' ? 'O longão veio sem a distância. Tente de novo.' : 'A rodagem veio sem a distância. Tente de novo.');
  const seconds = main.targetSeconds ?? main.minutes * 60;
  const pace = seconds / (main.meters / 1000);
  if (pace < athlete.paceSecondsPerKm - 5 || pace > athlete.paceSecondsPerKm + 150) {
    throw new Error(kind === 'long' ? 'O ritmo do longão não combina com o que você corre hoje. Tente de novo.' : 'O ritmo da rodagem não combina com o que você corre hoje. Tente de novo.');
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
