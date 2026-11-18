import type { RuntimeStep } from '@/types/domain';

import { type EngineSnapshot, type StepResult, stepRemaining } from './engine';
import { spokenDuration } from './plan';

export type PaceState = 'ahead' | 'on' | 'behind';

export function introLine(steps: RuntimeStep[]): string {
  const first = steps[0];
  if (!first) return '';
  return `Treino guiado com ${steps.length} etapas. Começa em 10 segundos com ${first.label.toLowerCase()}, ${targetSpeech(first)}.`;
}

export function coachLine(prev: EngineSnapshot, next: EngineSnapshot, steps: RuntimeStep[]): string | null {
  if (prev.status === 'countdown' && next.status === 'countdown') {
    return countdownNumber(prev.countdown, next.countdown);
  }
  if (next.results.length > prev.results.length) {
    const result = next.results[next.results.length - 1];
    const done = steps.find((step) => step.id === result.stepId);
    const moreWork = steps.slice(next.results.length).some((step) => step.kind === 'work');
    const parts = done ? [resultLine(done, result, moreWork)] : [];
    parts.push(next.status === 'finished' ? summaryLine(next.results, steps) : startLine(steps[next.stepIndex], next.stepDistanceMeters));
    return parts.filter(Boolean).join(' ');
  }
  if (next.status === 'finished' && prev.status !== 'finished') return summaryLine(next.results, steps);
  if (prev.status === 'countdown' && next.status === 'running') return startLine(steps[next.stepIndex], next.stepDistanceMeters);
  if (next.status !== 'running' || prev.stepIndex !== next.stepIndex) return null;

  const step = steps[next.stepIndex];
  if (!step) return null;
  const following = steps[next.stepIndex + 1];
  const before = stepRemaining(step, prev);
  const after = stepRemaining(step, next);

  if (step.target.type === 'time') {
    if (step.target.seconds > 20 && crossed(before, after, 10)) return tenSecondLine(step, following);
    if (following?.kind === 'work') return countdownNumber(before, after);
    return null;
  }

  const total = step.target.meters;
  if (total >= 300 && crossed(before, after, 100)) {
    const pace = step.kind === 'work' ? paceState(step, next) : null;
    return `Faltam 100 metros. ${pace === 'behind' ? 'Acelera, dá tempo!' : 'Segura até o fim!'}`;
  }
  if (total >= 300 && crossed(before, after, total / 2)) {
    if (step.kind !== 'work' || !step.goalSeconds) return `Metade ${step.kind === 'steady' ? 'do bloco' : 'da etapa'}. Mantém o ritmo.`;
    const pace = paceState(step, next);
    if (pace === 'behind') return 'Metade do tiro. Você está um pouco atrás do tempo, acelere.';
    if (pace === 'ahead') return 'Metade do tiro. Está adiantado, segure para não quebrar no final.';
    return 'Metade do tiro. No tempo certo, mantenha.';
  }
  return null;
}

export function kilometerLine(kilometer: number, paceSecondsPerKm: number | null): string {
  if (!paceSecondsPerKm || !Number.isFinite(paceSecondsPerKm)) return `Quilômetro ${kilometer}.`;
  return `Quilômetro ${kilometer}. Ritmo de ${spokenDuration(paceSecondsPerKm)} por quilômetro.`;
}

export function paceState(step: RuntimeStep, snapshot: EngineSnapshot): PaceState | null {
  if (step.kind !== 'work' || step.target.type !== 'distance' || !step.goalSeconds) return null;
  if (snapshot.stepDistanceMeters < 30) return null;
  const expected = step.goalSeconds * Math.min(1, snapshot.stepDistanceMeters / step.target.meters);
  const diff = snapshot.stepMovingSeconds - expected;
  if (diff > 3) return 'behind';
  if (diff < -5) return 'ahead';
  return 'on';
}

export function targetSpeech(step: RuntimeStep): string {
  if (step.target.type === 'distance') {
    const distance = spokenMeters(step.target.meters);
    return step.goalSeconds ? `${distance} em ${spokenDuration(step.goalSeconds)}` : distance;
  }
  return spokenDuration(step.target.seconds);
}

function startLine(step: RuntimeStep | undefined, coveredMeters = 0): string {
  if (!step) return '';
  if (step.target.type === 'distance' && coveredMeters > 0 && coveredMeters < step.target.meters) {
    const left = step.target.meters - coveredMeters;
    return `${step.label}: faltam ${spokenMeters(left)}. Os ${spokenMeters(coveredMeters)} do aquecimento já entraram na conta.`;
  }
  if (step.kind === 'work') return `Vai! ${step.label}. ${capitalize(targetSpeech(step))}.`;
  if (step.kind === 'recovery') return `Descanso de ${targetSpeech(step)}, ${step.manner ?? 'caminhando'}.`;
  return `${step.label}: ${targetSpeech(step)}. ${step.detail}`;
}

function resultLine(step: RuntimeStep, result: StepResult, moreWork: boolean): string {
  if (result.status === 'skipped') {
    if (result.seconds <= 0 && result.meters <= 0) return `${step.label} pulado.`;
    const effort = result.meters > 0 ? `${spokenMeters(result.meters)} em ${spokenDuration(result.seconds)}` : spokenDuration(result.seconds);
    return `${step.label} pulado. Até aqui, ${effort}.`;
  }
  if (step.kind === 'recovery') return '';
  const time = spokenDuration(result.seconds);
  if (step.kind !== 'work') return `${step.label} concluído em ${time}.`;
  if (result.onTarget === null) return `${step.label} concluído.`;
  if (step.target.type === 'time') return `${step.label} concluído!`;
  if (result.onTarget) return `${step.label} em ${time}. Dentro do tempo!`;
  const over = Math.max(1, Math.round(result.seconds - (step.goalSeconds ?? result.seconds)));
  const advice = moreWork ? ' No próximo, solte um pouco mais cedo.' : '';
  return `${step.label} em ${time}, ${over} segundos acima do alvo.${advice}`;
}

function summaryLine(results: StepResult[], steps: RuntimeStep[]): string {
  const works = steps.filter((step) => step.kind === 'work');
  if (works.length === 0) return 'Treino concluído! Mandou bem.';
  const hits = results.filter((result) => result.onTarget === true).length;
  return `Treino concluído! ${hits} de ${works.length} tiros dentro do tempo.`;
}

function tenSecondLine(step: RuntimeStep, following: RuntimeStep | undefined): string {
  if (step.kind === 'work') return 'Faltam 10 segundos. Segura!';
  if (following?.kind === 'work') return `Em 10 segundos começa o ${following.label.toLowerCase()}. ${capitalize(targetSpeech(following))}. Prepare-se.`;
  if (following) return `Faltam 10 segundos. Depois vem ${following.label.toLowerCase()}.`;
  return 'Faltam 10 segundos para terminar o treino.';
}

function countdownNumber(before: number, after: number): string | null {
  const from = Math.ceil(before);
  const to = Math.ceil(after);
  if (to === from || to < 1 || to > 3) return null;
  return String(to);
}

function crossed(before: number, after: number, threshold: number): boolean {
  return before > threshold && after <= threshold;
}

function spokenMeters(meters: number): string {
  if (meters >= 1000) {
    const km = (meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `${km} ${meters === 1000 ? 'quilômetro' : 'quilômetros'}`;
  }
  return `${Math.round(meters)} metros`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
