import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { onboardingSchema, type OnboardingValues } from '@/features/onboarding/schema';
import { answerAt, planQuestions } from '@/features/onboarding/steps';
import { useSession } from '@/stores/session';

export function Onboarding() {
  const completeOnboarding = useSession((state) => state.completeOnboarding);
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Partial<OnboardingValues>>({});
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [answers, setAnswers] = useState<OnboardingValues | null>(null);
  const question = planQuestions[index];

  function show(nextIndex: number, nextValues: Partial<OnboardingValues>) {
    const next = planQuestions[nextIndex];
    setIndex(nextIndex);
    setError(null);
    if (next?.kind === 'number') {
      const stored = answerAt(nextValues, next.field);
      setDraft(stored == null ? '' : next.display(stored));
    }
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

  function commitNumber() {
    if (!question || question.kind !== 'number') return;
    const parsed = Number(draft.replace(',', '.').trim());
    if (!Number.isFinite(parsed)) {
      setError('Informe um número.');
      return;
    }
    const value = question.convert(parsed);
    if (value == null) {
      setError(question.error);
      return;
    }
    const next = { ...values, [question.field]: value };
    setValues(next);
    if (index < planQuestions.length - 1) {
      show(index + 1, next);
      return;
    }
  }

  function chooseLevel(value: OnboardingValues['level']) {
    const next = { ...values, level: value };
    setValues(next);
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
        <button className="back" type="button" onClick={() => (index === 0 ? navigate('/inicio') : show(index - 1, values))}>
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
      {question.kind === 'number' ? (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            commitNumber();
          }}
        >
          <label>
            {question.unit}
            <input inputMode="decimal" placeholder={question.placeholder} value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn primary" type="submit">
            Continuar
          </button>
        </form>
      ) : (
        <>
          <div className="options">
            {question.options.map((option) => {
              const selected = values.level === option.value;
              return (
                <button key={option.value} className={selected ? 'option selected' : 'option'} type="button" onClick={() => chooseLevel(option.value)}>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              );
            })}
          </div>
          {error ? <p className="error">{error}</p> : null}
        </>
      )}
    </main>
  );
}
