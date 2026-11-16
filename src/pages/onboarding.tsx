import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { onboardingSchema, type OnboardingValues } from '@/features/onboarding/schema';
import { planQuestions, questionsFor } from '@/features/onboarding/steps';
import { useSession } from '@/stores/session';

export function Onboarding() {
  const completeOnboarding = useSession((state) => state.completeOnboarding);
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Partial<OnboardingValues>>({});
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [answers, setAnswers] = useState<OnboardingValues | null>(null);
  const questions = questionsFor(values);
  const question = questions[index];

  function show(nextIndex: number) {
    setIndex(nextIndex);
    setError(null);
  }

  async function finish(nextValues: OnboardingValues) {
    setAnswers(nextValues);
    setBuilding(true);
    setError(null);
    try {
      await completeOnboarding(nextValues);
      navigate('/plano');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível montar o plano.');
    }
  }

  function choose(value: number | OnboardingValues['level']) {
    if (!question || question.kind !== 'choice') return;
    const next: Partial<OnboardingValues> = { ...values };
    if (question.field === 'level') {
      if (value !== 'beginner' && value !== 'intermediate' && value !== 'advanced') return;
      next.level = value;
    } else if (typeof value === 'number') {
      next[question.field] = value;
    }
    setValues(next);
    if (question.field === 'currentDistanceMeters' && next.currentDistanceMeters !== values.currentDistanceMeters) {
      delete next.currentDurationSeconds;
    }
    if (index < planQuestions.length - 1) {
      show(index + 1);
      return;
    }
    const parsed = onboardingSchema.safeParse(next);
    if (!parsed.success) {
      setError('Faltou alguma resposta.');
      return;
    }
    void finish(parsed.data);
  }

  if (building) {
    return (
      <main className="building">
        {error ? (
          <>
            <h1>Não deu para montar o treino</h1>
            <p className="muted">{error}</p>
            <button className="btn primary" type="button" disabled={!answers} onClick={() => answers && void finish(answers)}>
              Tentar de novo
            </button>
            <button className="btn text" type="button" onClick={() => { setBuilding(false); setError(null); }}>
              Voltar
            </button>
          </>
        ) : (
          <>
            <span className="building-spin" aria-hidden="true" />
            <p className="eyebrow">Plano</p>
            <h1>Estamos montando seu treino</h1>
            <p className="muted">Rodagem, tiros e longão, em etapas.</p>
          </>
        )}
      </main>
    );
  }

  if (!question) return null;

  return (
    <main className="screen auth-screen">
      <div className="row-between">
        <button className="back" type="button" onClick={() => (index === 0 ? navigate('/inicio') : show(index - 1))}>
          Voltar
        </button>
        <p className="eyebrow">
          {index + 1} DE {planQuestions.length}
        </p>
      </div>
      <div>
        <h1>{question.title}</h1>
        <p className="muted">{question.subtitle}</p>
      </div>
      <div className="options">
        {question.options.map((option) => {
          const selected = values[question.field] === option.value;
          return (
            <button key={option.label} className={selected ? 'option selected' : 'option'} type="button" onClick={() => choose(option.value)}>
              <strong>{option.label}</strong>
              {option.description ? <span>{option.description}</span> : null}
            </button>
          );
        })}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
