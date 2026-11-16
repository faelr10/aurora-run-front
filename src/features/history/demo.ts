import type { Activity, RunnerProfile, TrackPoint } from '@/types/domain';
import { saveCompletedActivity } from '@/services/storage/database';
import { addDays, mondayOf, toDateKey } from '@/utils/format';
import { estimateCalories } from '@/utils/geo';

export function demoProfile(today = new Date()): RunnerProfile {
  const done = toDateKey(addDays(today, -2));
  return {
    age: 32,
    weightKg: 74,
    currentDistanceMeters: 5000,
    currentDurationSeconds: 30 * 60,
    goalDistanceMeters: 10000,
    level: 'intermediate',
    planStartedAt: toDateKey(today),
    plan: {
      summary: 'Duas etapas de exemplo até os 10 km, sem dia fixo. O check fica na data em que o treino acontece.',
      stages: [
        {
          id: 'etapa-1',
          title: 'Base confortável',
          focus: 'Correr solto e conhecer o ritmo de conversa.',
          workouts: [
            {
              id: 'etapa-1-easy',
              kind: 'easy',
              title: 'Rodagem leve',
              objective: 'Terminar conseguindo falar frases curtas.',
              distanceMeters: 4000,
              durationMinutes: 32,
              completedOn: done,
              steps: [
                { label: 'Aquecimento', detail: 'Caminhe 5 minutos, soltando os ombros.', minutes: 5 },
                { label: 'Rodagem', detail: 'Corra 3,2 km em ritmo de conversa, perto de 6:50/km. Frases curtas têm de sair inteiras.', minutes: 22, meters: 3200, targetSeconds: 22 * 60 },
                { label: 'Desaquecimento', detail: 'Caminhe 5 minutos até a respiração baixar.', minutes: 5 },
              ],
            },
            {
              id: 'etapa-1-intervals',
              kind: 'intervals',
              title: 'Tiros curtos',
              objective: 'Acordar a passada sem perder a forma.',
              distanceMeters: 3600,
              durationMinutes: 32,
              completedOn: null,
              steps: [
                { label: 'Aquecimento', detail: 'Trote bem leve por 8 minutos, sem pressa.', minutes: 8 },
                {
                  label: 'Tiro',
                  detail: 'Corra 400 m em 2:15, forte e controlado, sem sprint. Depois caminhe 1 minuto e 30 segundos.',
                  minutes: 3,
                  repeats: 5,
                  meters: 400,
                  targetSeconds: 135,
                  recoverySeconds: 90,
                  recoveryDetail: 'caminhando',
                },
                { label: 'Desaquecimento', detail: 'Caminhe 5 minutos até a respiração baixar.', minutes: 5 },
              ],
            },
            {
              id: 'etapa-1-long',
              kind: 'long',
              title: 'Longão',
              objective: 'Ficar mais tempo de pé, em ritmo mais leve que a rodagem.',
              distanceMeters: 6200,
              durationMinutes: 52,
              completedOn: null,
              steps: [
                { label: 'Aquecimento', detail: 'Caminhe ou trote bem leve por 8 minutos.', minutes: 8 },
                { label: 'Longão', detail: 'Corra 5,2 km mais lento que a rodagem, perto de 7:20/km. Se a fala falhar, diminua.', minutes: 38, meters: 5200, targetSeconds: 38 * 60 },
                { label: 'Desaquecimento', detail: 'Caminhe 6 minutos.', minutes: 6 },
              ],
            },
          ],
        },
        {
          id: 'etapa-2',
          title: 'Um pouco mais longe',
          focus: 'Aumentar o longão sem apertar a rodagem.',
          workouts: [
            {
              id: 'etapa-2-easy',
              kind: 'easy',
              title: 'Rodagem leve',
              objective: 'Repetir o ritmo fácil com um pouco mais de tempo.',
              distanceMeters: 4800,
              durationMinutes: 37,
              completedOn: null,
              steps: [
                { label: 'Aquecimento', detail: 'Caminhe 5 minutos.', minutes: 5 },
                { label: 'Rodagem', detail: 'Corra 4 km em ritmo de conversa, perto de 6:45/km.', minutes: 27, meters: 4000, targetSeconds: 27 * 60 },
                { label: 'Desaquecimento', detail: 'Caminhe 5 minutos.', minutes: 5 },
              ],
            },
            {
              id: 'etapa-2-intervals',
              kind: 'intervals',
              title: 'Tiros',
              objective: 'Sustentar o trecho forte com recuperação completa.',
              distanceMeters: 4000,
              durationMinutes: 30,
              completedOn: null,
              steps: [
                { label: 'Aquecimento', detail: 'Trote leve.', minutes: 8 },
                {
                  label: 'Tiro',
                  detail: 'Corra 500 m em 2:50, forte e controlado. Depois caminhe 2 minutos.',
                  minutes: 3,
                  repeats: 5,
                  meters: 500,
                  targetSeconds: 170,
                  recoverySeconds: 120,
                  recoveryDetail: 'caminhando',
                },
                { label: 'Desaquecimento', detail: 'Trote solto.', minutes: 6 },
              ],
            },
            {
              id: 'etapa-2-long',
              kind: 'long',
              title: 'Longão',
              objective: 'Chegar perto da meta sem acelerar no final.',
              distanceMeters: 8000,
              durationMinutes: 66,
              completedOn: null,
              steps: [
                { label: 'Aquecimento', detail: 'Caminhe ou trote bem leve por 8 minutos.', minutes: 8 },
                { label: 'Longão', detail: 'Corra 7 km perto de 7:30/km, mais lento que a rodagem. Não acelere no final.', minutes: 52, meters: 7000, targetSeconds: 52 * 60 },
                { label: 'Desaquecimento', detail: 'Caminhe 6 minutos.', minutes: 6 },
              ],
            },
          ],
        },
      ],
    },
  };
}

export async function ensureDemoActivities(email: string, today = new Date()): Promise<void> {
  const monday = mondayOf(today);
  const runs: { index: number; daysAgo: number; distance: number; pace: number; source: Activity['source']; title: string }[] = [
    { index: 1, daysAgo: 52, distance: 4200, pace: 430, source: 'free', title: 'Rodagem leve' },
    { index: 2, daysAgo: 45, distance: 5000, pace: 418, source: 'guided', title: 'Treino de qualidade' },
    { index: 3, daysAgo: 38, distance: 6400, pace: 405, source: 'free', title: 'Rodagem progressiva' },
    { index: 4, daysAgo: 31, distance: 8000, pace: 392, source: 'guided', title: 'Longão' },
    { index: 5, daysAgo: 24, distance: 10000, pace: 378, source: 'free', title: '10 km' },
    { index: 6, daysAgo: 16, distance: 21100, pace: 392, source: 'free', title: '21 km' },
    { index: 7, daysAgo: 8, distance: 6100, pace: 360, source: 'guided', title: 'Rodagem leve' },
    { index: 8, daysAgo: 1, distance: 5210, pace: 377, source: 'guided', title: 'Treino de qualidade' },
  ];

  for (const run of runs) {
    const started = new Date(monday);
    started.setDate(started.getDate() - run.daysAgo);
    started.setHours(7, 10, 0, 0);
    const movingSeconds = Math.round((run.distance / 1000) * run.pace);
    const startedAt = started.toISOString();
    const endedAt = new Date(started.getTime() + movingSeconds * 1000).toISOString();
    const activity: Activity = {
      clientId: `demo:${email}:${run.index}`,
      ownerEmail: email,
      sessionId: null,
      source: run.source,
      status: 'completed',
      title: run.title,
      startedAt,
      endedAt,
      movingSeconds,
      movingAnchorAt: null,
      distanceMeters: run.distance,
      averagePaceSecondsPerKm: run.pace,
      calories: estimateCalories(run.distance),
      demo: true,
      syncedAt: null,
      points: loopPoints(-23.5874, -46.6576, 24, 180 + run.index * 12, started.getTime()),
      splits: Array.from({ length: Math.floor(run.distance / 1000) }, (_, index) => ({
        kilometer: index + 1,
        durationSeconds: run.pace,
        paceSecondsPerKm: run.pace,
      })),
    };
    await saveCompletedActivity(activity);
  }
}

function loopPoints(latitude: number, longitude: number, count: number, radiusMeters: number, startedAt: number): TrackPoint[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      latitude: latitude + (radiusMeters / 111_320) * Math.sin(angle),
      longitude: longitude + (radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180))) * Math.cos(angle),
      accuracy: 8,
      timestamp: startedAt + index * 20_000,
      speed: 3,
    };
  });
}
