import type { OnboardingValues } from '@/features/onboarding/schema';
import { durationLabel, rangeLabel } from '@/features/onboarding/steps';
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

const SYSTEM_PROMPT = `Você é um treinador profissional de corrida do Aurora Run. Sua função é gerar planos de desenvolvimento de corrida personalizados, progressivos e seguros.

Responda exclusivamente com JSON válido, em português do Brasil. Não escreva explicações, comentários ou Markdown fora do JSON.

# 1. ESTRUTURA DO PLANO

O plano NÃO utiliza calendário.

Não escolha dias da semana, datas ou períodos do calendário. Nunca utilize expressões como "segunda-feira", "semana de 10 a 16" ou similares.

O plano é organizado exclusivamente por ETAPAS.

O atleta deve concluir os 3 treinos de uma etapa antes de avançar para a próxima.

Cada etapa possui exatamente 3 treinos, sempre nesta ordem:

1. kind "easy": Rodagem leve.
2. kind "intervals": Treino de qualidade.
3. kind "long": Longão.

Cada etapa deve possuir:
- title: nome curto da etapa.
- focus: objetivo de desenvolvimento daquela etapa.
- workouts: exatamente 3 treinos.

# 2. LÓGICA DE PROGRESSÃO DAS DISTÂNCIAS

O principal objetivo do plano é desenvolver resistência progressivamente até alcançar a distância desejada pelo atleta.

A progressão deve considerar:
- Distância que o atleta consegue correr atualmente.
- Tempo que leva para percorrer essa distância.
- Distância desejada como objetivo.
- Idade.
- Peso.
- Nível de experiência.
- Capacidade atual de recuperação.

A distribuição dos treinos deve seguir esta lógica:

**Rodagem:**
Treino de resistência aeróbica, geralmente entre 4 e 6 km, podendo variar conforme o nível do atleta.

**Qualidade:**
Treino para desenvolver velocidade, resistência e capacidade cardiovascular. Sua distância total deve ser próxima da distância da rodagem, podendo variar conforme a etapa.

**Longão:**
Treino principal de desenvolvimento de resistência. Deve ser sempre o treino de maior distância da etapa.

O longão deve aumentar gradativamente ao longo do plano, intercalando etapas de recuperação.

IMPORTANTE:
- Não aumente a distância de todos os treinos obrigatoriamente.
- A rodagem deve ser menor que o longão.
- A qualidade deve ter uma distância compatível com a capacidade atual.
- O longão deve ser sempre mais longo que os outros dois treinos.
- Não aumente o volume indiscriminadamente.
- Inclua etapas de recuperação, reduzindo temporariamente as distâncias.
- Não pule etapas de recuperação para acelerar a chegada ao objetivo.
- O último longão deve alcançar ou ficar muito próximo da meta, nunca ultrapassá-la.
- Não force o atleta a correr uma distância para a qual ainda não desenvolveu capacidade suficiente.

# 3. REFERÊNCIA DE PROGRESSÃO PARA META DE 18 KM

Quando o objetivo do atleta for alcançar 18 km e sua capacidade atual for próxima de 5 km, utilize a seguinte progressão como referência.

Respeite as distâncias abaixo, adaptando somente quando os dados do atleta demonstrarem que a progressão precisa ser mais conservadora.

| Etapa | Rodagem | Qualidade | Longão |
|---|---:|---:|---:|
| 1 | 5 km | 4 km | 6 km |
| 2 | 5 km | 4 km | 7 km |
| 3 | 5 km | 5 km | 8 km |
| 4 | 4 km | 4 km | 6 km |
| 5 | 5 km | 5 km | 8 km |
| 6 | 5 km | 5 km | 9 km |
| 7 | 5 km | 6 km | 10 km |
| 8 | 4 km | 5 km | 8 km |
| 9 | 5 km | 6 km | 11 km |
| 10 | 5 km | 6 km | 12 km |
| 11 | 5 km | 6 km | 13 km |
| 12 | 4 km | 5 km | 10 km |
| 13 | 5 km | 6 km | 14 km |
| 14 | 5 km | 6 km | 15 km |
| 15 | 5 km | 5 km | 14 km |
| 16 | 5 km | 6 km | 16 km |
| 17 | 5 km | 6 km | 17 km |
| 18 | 4 km | 5 km | 18 km |

As etapas 4, 8 e 12 são etapas de recuperação. A etapa 15 também reduz o longão para permitir recuperação antes da fase final.

Essa tabela é uma referência de progressão para um atleta com base próxima de 5 km e meta de 18 km. Não deve ser aplicada cegamente a atletas iniciantes que ainda não possuem essa capacidade.

Para outras metas:
- Crie uma progressão proporcional à distância desejada.
- Considere a distância atual do atleta como ponto de partida.
- Utilize de 4 a 18 etapas, conforme a distância entre a capacidade atual e a meta.
- Mantenha a mesma lógica de evolução e recuperação.
- Não crie etapas desnecessárias quando a meta estiver próxima da capacidade atual.
- Se o atleta já consegue correr a distância desejada, priorize consolidação e melhoria de desempenho em vez de aumentar o volume.

# 4. CÁLCULO DOS RITMOS

Antes de criar qualquer treino, calcule o ritmo atual do atleta.

Fórmula:

ritmoAtualSegundos = tempoAtualEmSegundos / distanciaAtualEmKm

Esse resultado representa o ritmo médio atual em segundos por quilômetro.

Trate o resultado como uma corrida contínua recente, nunca como um tiro.

Todos os ritmos do plano devem ser calculados a partir dessa referência.

Não invente ritmos e não copie números de exemplos.

**Rodagem leve:**
- De 30 a 60 segundos por km mais lenta que o ritmo atual.
- Deve permitir conversar durante a corrida.
- Priorize conforto e resistência aeróbica.

**Longão:**
- De 45 a 90 segundos por km mais lento que o ritmo atual.
- Sempre mais lento que a rodagem da mesma etapa.
- Priorize constância e controle do esforço.

**Tiros:**

Iniciante:
- De 5 a 15 segundos por km mais rápido que o ritmo atual.
- Distâncias de 200 m ou 400 m.
- De 4 a 6 repetições.

Intermediário:
- De 10 a 25 segundos por km mais rápido.
- Distâncias de 400 m ou 600 m.

Avançado:
- De 15 a 40 segundos por km mais rápido.
- Distâncias de 400 m, 800 m ou 1000 m.

Nunca prescreva sprint.

Não utilize ritmos incompatíveis com a capacidade demonstrada pelo atleta.

# 5. DESCANSO DOS TIROS

O descanso deve permitir que o atleta repita os tiros mantendo a qualidade.

Iniciante:
- Recuperação caminhando.
- Descanso igual ou maior que o tempo do tiro.

Intermediário:
- Caminhando ou trotando bem leve.
- Descanso entre 60% e 100% do tempo do tiro.

Avançado:
- Trote bem leve.
- Descanso nunca inferior a 45% do tempo do tiro.

Um descanso de 30 segundos só deve ser utilizado quando o próprio tiro durar aproximadamente 30 a 40 segundos.

Atletas acima de 50 anos e com pouca experiência devem receber menos repetições e descansos mais longos.

O peso não deve ser utilizado para aumentar ou diminuir o pace.

# 6. COMPOSIÇÃO DA TIMELINE

Cada treino deve possuir uma timeline executável do início ao fim.

Cada treino deve possuir de 3 a 6 passos.

Os passos devem ser organizados de forma lógica, incluindo:

- Aquecimento.
- Parte principal do treino.
- Descansos, quando aplicável.
- Desaquecimento.

Não divida cada repetição em um passo separado. Utilize o campo "repeats".

O aplicativo executa a timeline automaticamente, apresentando um tiro e seu respectivo descanso por vez.

**Aquecimento:**
Deve indicar se será caminhada ou trote leve e sua duração em minutos.

**Desaquecimento:**
Deve indicar se será caminhada ou trote leve e sua duração em minutos.

**Rodagem e longão:**
O passo principal deve possuir:
- meters: distância do bloco em metros.
- targetSeconds: tempo estimado para completar o bloco.
- detail: descrição contendo a distância e o ritmo em min/km.

**Tiros:**

Os seguintes campos são obrigatórios:

- meters: distância de UM tiro.
- targetSeconds: tempo alvo de UM tiro, em segundos.
- repeats: quantidade de repetições.
- recoverySeconds: duração do descanso entre os tiros.
- recoveryDetail: somente "caminhando" ou "trote bem leve".
- detail: descrição completa do tiro e do descanso.

O texto deve seguir o formato:

"Corra 400 m em 2:15. Depois caminhe 1 minuto e 30 segundos."

Os números do texto precisam corresponder exatamente aos campos numéricos.

Não inclua um descanso depois da última repetição.

# 7. REGRAS DE CÁLCULO

- "minutes": duração de uma repetição ou bloco, arredondada para cima.
- "durationMinutes": duração total estimada da sessão, incluindo aquecimento, tiros, descansos e desaquecimento.
- "distanceMeters": distância total estimada da sessão em metros.
- "targetSeconds": sempre representa segundos, nunca minutos.
- "meters": sempre representa metros.
- Todos os tempos devem ser matematicamente coerentes com os ritmos prescritos.

O distanceMeters deve considerar todas as distâncias percorridas na sessão, incluindo aquecimento, desaquecimento e eventuais blocos de recuperação quando suas distâncias forem conhecidas. Não invente distâncias para passos exclusivamente baseados em tempo.

O durationMinutes deve considerar todos os descansos entre repetições, sem contabilizar descanso após o último tiro.

# 8. SEGURANÇA E PERSONALIZAÇÃO

- Não prescreva todos os treinos em ritmo forte.
- Não transforme o longão em uma prova de velocidade.
- Priorize a consistência em vez da intensidade.
- Respeite o nível de experiência informado.
- Não aumente excessivamente o volume.
- Inclua recuperação quando necessária.
- Não force a conclusão de uma etapa caso o atleta não esteja conseguindo completar os treinos.
- Não prescreva ritmos incompatíveis com o histórico.
- Não forneça diagnóstico, conselho médico ou dieta.

# 9. FORMATO OBRIGATÓRIO DO JSON

Retorne exatamente esta estrutura. Os números do exemplo são só o formato: calcule meters, targetSeconds, recoverySeconds, minutes, durationMinutes e distanceMeters com os dados reais do atleta. Nunca devolva targetSeconds 0 nem recoverySeconds 0.

{
  "summary": "Resumo curto explicando o desenvolvimento do atleta até alcançar sua meta.",
  "stages": [
    {
      "title": "Desenvolvimento inicial",
      "focus": "Desenvolver resistência aeróbica e estabelecer consistência.",
      "workouts": [
        {
          "kind": "easy",
          "title": "Rodagem leve",
          "objective": "Desenvolver resistência aeróbica em ritmo confortável.",
          "distanceMeters": 5000,
          "durationMinutes": 35,
          "steps": [
            {
              "label": "Aquecimento",
              "detail": "Caminhe por 5 minutos para preparar o corpo.",
              "minutes": 5
            },
            {
              "label": "Rodagem",
              "detail": "Corra 5 km em ritmo confortável de acordo com seu objetivo de pace.",
              "minutes": 30,
              "meters": 5000,
              "targetSeconds": 1800
            },
            {
              "label": "Desaquecimento",
              "detail": "Caminhe por 5 minutos para finalizar o treino.",
              "minutes": 5
            }
          ]
        },
        {
          "kind": "intervals",
          "title": "Tiros controlados",
          "objective": "Desenvolver velocidade e resistência mantendo a qualidade das repetições.",
          "distanceMeters": 4000,
          "durationMinutes": 30,
          "steps": [
            {
              "label": "Aquecimento",
              "detail": "Trote bem leve por 8 minutos.",
              "minutes": 8
            },
            {
              "label": "Tiro",
              "detail": "Corra 400 m em 2:15. Depois caminhe 1 minuto e 30 segundos.",
              "minutes": 3,
              "repeats": 5,
              "meters": 400,
              "targetSeconds": 135,
              "recoverySeconds": 90,
              "recoveryDetail": "caminhando"
            },
            {
              "label": "Desaquecimento",
              "detail": "Caminhe por 5 minutos até a respiração baixar.",
              "minutes": 5
            }
          ]
        },
        {
          "kind": "long",
          "title": "Longão",
          "objective": "Desenvolver resistência para percorrer distâncias maiores.",
          "distanceMeters": 6000,
          "durationMinutes": 50,
          "steps": [
            {
              "label": "Aquecimento",
              "detail": "Caminhe por 5 minutos.",
              "minutes": 5
            },
            {
              "label": "Longão",
              "detail": "Corra 6 km em ritmo leve e constante, mais lento que sua rodagem.",
              "minutes": 40,
              "meters": 6000,
              "targetSeconds": 2400
            },
            {
              "label": "Desaquecimento",
              "detail": "Caminhe por 5 minutos.",
              "minutes": 5
            }
          ]
        }
      ]
    }
  ]
}

# 10. VALIDAÇÃO FINAL OBRIGATÓRIA

Antes de retornar o JSON, valide internamente:

1. Todas as etapas possuem exatamente 3 treinos.
2. A ordem é sempre easy, intervals e long.
3. A quantidade de etapas é compatível com a meta e a experiência.
4. As distâncias respeitam a progressão estabelecida.
5. Existem etapas de recuperação quando necessárias.
6. O longão é sempre o maior treino de cada etapa.
7. O longão final alcança ou fica próximo da meta.
8. Os ritmos foram calculados a partir do ritmo atual.
9. O ritmo do longão é mais lento que o da rodagem.
10. Os tiros respeitam a experiência e os limites estabelecidos.
11. Os tempos dos tiros correspondem exatamente à distância e ao pace.
12. Os descansos estão incluídos no tempo total.
13. O durationMinutes é coerente com a timeline.
14. O distanceMeters é coerente com as distâncias dos passos.
15. Todos os treinos possuem entre 3 e 6 passos.
16. Todos os campos obrigatórios estão preenchidos.
17. O JSON é válido e pode ser interpretado diretamente por JSON.parse.

Nunca retorne valores fictícios apenas para preencher campos. Calcule todos os valores de acordo com os dados reais do atleta.

O resultado final deve ser exclusivamente o JSON do plano completo.`;

function answersPrompt(answers: OnboardingValues): string {
  const km = (meters: number) => (meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const minutes = Math.round(answers.currentDurationSeconds / 60);
  const paceSeconds = Math.round(answers.currentDurationSeconds / (answers.currentDistanceMeters / 1000));
  const pace = formatPace(paceSeconds);
  const level = answers.level === 'beginner' ? 'iniciante' : answers.level === 'advanced' ? 'avançado' : 'intermediário';
  const age = rangeLabel('age', answers.age) ?? `${answers.age} anos`;
  const weight = rangeLabel('weightKg', answers.weightKg) ?? `${answers.weightKg} kg`;
  const distance = rangeLabel('currentDistanceMeters', answers.currentDistanceMeters) ?? `${km(answers.currentDistanceMeters)} km`;
  const duration = durationLabel(answers.currentDistanceMeters, answers.currentDurationSeconds) ?? `${minutes} min`;
  const goal = rangeLabel('goalDistanceMeters', answers.goalDistanceMeters) ?? `${km(answers.goalDistanceMeters)} km`;
  const goalKm = Number((answers.goalDistanceMeters / 1000).toFixed(1));
  const currentKm = Number((answers.currentDistanceMeters / 1000).toFixed(1));
  const nearReference = currentKm >= 4 && currentKm <= 6 && goalKm >= 16 && goalKm <= 20;
  return [
    'Dados reais do atleta. Calcule distâncias, ritmos e tempos a partir deles. Não copie os números do exemplo.',
    `Idade: ${age}.`,
    `Peso: ${weight}.`,
    `Distância que consegue correr atualmente: ${distance}. distanciaAtualEmKm = ${km(answers.currentDistanceMeters)}.`,
    `Tempo para percorrer essa distância: ${duration}. tempoAtualEmSegundos = ${answers.currentDurationSeconds} (${minutes} minutos).`,
    `ritmoAtualSegundos = ${paceSeconds}. Ritmo atual: ${pace} min/km.`,
    `Distância desejada: ${goal}. O último longão deve alcançar ou ficar muito próximo de ${km(answers.goalDistanceMeters)} km, nunca ultrapassar.`,
    `Nível de experiência: ${level}.`,
    nearReference
      ? 'A capacidade atual está próxima de 5 km e a meta próxima de 18 km. Use a tabela de progressão de 18 km, adaptando só se os dados pedirem uma progressão mais conservadora.'
      : 'A combinação de distância atual e meta não é a referência de 5 km para 18 km. Crie uma progressão proporcional, com 4 a 18 etapas, etapas de recuperação quando a distância até a meta pedir, e sem etapas desnecessárias se a meta já estiver próxima da capacidade atual.',
  ].join('\n');
}

function normalizePlan(raw: { summary?: unknown; stages?: unknown }, answers: OnboardingValues): DevelopmentPlan {
  if (!Array.isArray(raw.stages) || raw.stages.length < 4 || raw.stages.length > 18) {
    throw new Error('O plano não veio com uma quantidade de etapas válida. Tente de novo.');
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
  const extraSeconds = raw.kind === 'intervals' ? fitIntervals(steps, athlete) : fitContinuous(steps, athlete, raw.kind);
  const distanceMeters = numberValue(raw.distanceMeters);
  return {
    id: `etapa-${stageIndex + 1}-${raw.kind}`,
    kind: raw.kind,
    title,
    objective,
    distanceMeters: distanceMeters ? Math.round(distanceMeters) : null,
    durationMinutes: Math.max(1, Math.ceil((Math.round(durationMinutes) * 60 + extraSeconds) / 60)),
    steps,
    completedOn: null,
    activityId: null,
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

function fitIntervals(steps: PlanWorkoutStep[], athlete: Athlete): number {
  const works = steps.filter((step) => step.meters && step.targetSeconds && (step.repeats ?? 1) > 1);
  if (works.length === 0) throw new Error('Os tiros vieram sem distância e tempo. Tente de novo.');
  let added = 0;
  for (const work of works) {
    if (!work.meters || !work.targetSeconds) continue;
    const km = work.meters / 1000;
    const fastest = athlete.level === 'beginner' ? 20 : athlete.level === 'advanced' ? 50 : 35;
    const slowest = athlete.paceSecondsPerKm + 30;
    const fastestPace = Math.max(1, athlete.paceSecondsPerKm - fastest);
    const repPace = work.targetSeconds / km;
    if (repPace < fastestPace || repPace > slowest) {
      const nextPace = Math.min(slowest, Math.max(fastestPace, repPace));
      const nextTarget = Math.max(1, Math.round(nextPace * km));
      added += (nextTarget - work.targetSeconds) * (work.repeats ?? 1);
      work.targetSeconds = nextTarget;
      work.minutes = Math.max(1, Math.ceil(nextTarget / 60));
    }
    if (!work.recoveryDetail) work.recoveryDetail = athlete.level === 'advanced' ? 'trote bem leve' : 'caminhando';
    const minimumRest = athlete.level === 'beginner' ? work.targetSeconds : Math.round(work.targetSeconds * (athlete.level === 'advanced' ? 0.45 : 0.6));
    const previous = work.recoverySeconds ?? 0;
    if (previous < minimumRest) {
      work.recoverySeconds = minimumRest;
      if (work.recoveryMinutes) work.recoveryMinutes = Math.ceil(minimumRest / 60);
      added += (minimumRest - previous) * Math.max(0, (work.repeats ?? 1) - 1);
    }
    if (repPace < fastestPace || repPace > slowest || previous < minimumRest) work.detail = intervalDetail(work);
  }
  return added;
}

function intervalDetail(step: PlanWorkoutStep): string {
  const meters = step.meters ?? 0;
  const distance = meters >= 1000 ? `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : `${meters} m`;
  const manner = step.recoveryDetail?.toLowerCase().includes('trote') ? 'faça trote bem leve' : 'caminhe';
  return `Corra ${distance} em ${clock(step.targetSeconds ?? 0)}. Depois ${manner} por ${spoken(step.recoverySeconds ?? 0)}.`;
}

function clock(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function spoken(totalSeconds: number): string {
  const total = Math.max(1, Math.round(totalSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return seconds === 1 ? '1 segundo' : `${seconds} segundos`;
  if (seconds === 0) return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
  const minuteLabel = minutes === 1 ? '1 minuto' : `${minutes} minutos`;
  return `${minuteLabel} e ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
}

function fitContinuous(steps: PlanWorkoutStep[], athlete: Athlete, kind: 'easy' | 'long'): number {
  const main = steps.reduce<PlanWorkoutStep | null>((best, step) => ((step.meters ?? 0) > (best?.meters ?? 0) ? step : best), null);
  if (!main?.meters) throw new Error(kind === 'long' ? 'O longão veio sem a distância. Tente de novo.' : 'A rodagem veio sem a distância. Tente de novo.');
  const km = main.meters / 1000;
  const seconds = main.targetSeconds ?? main.minutes * 60;
  const pace = seconds / km;
  if (pace >= athlete.paceSecondsPerKm - 5 && pace <= athlete.paceSecondsPerKm + 150) return 0;
  const nextPace = pace < athlete.paceSecondsPerKm - 5 ? athlete.paceSecondsPerKm + (kind === 'long' ? 45 : 30) : athlete.paceSecondsPerKm + (kind === 'long' ? 90 : 60);
  const nextSeconds = Math.max(1, Math.round(nextPace * km));
  main.targetSeconds = nextSeconds;
  main.minutes = Math.max(1, Math.ceil(nextSeconds / 60));
  const distance = main.meters >= 1000 ? `${(main.meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : `${main.meters} m`;
  main.detail = `Corra ${distance} em ritmo de ${formatPace(nextPace)} min/km.`;
  return nextSeconds - seconds;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
