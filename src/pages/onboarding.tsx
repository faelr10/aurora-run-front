import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { onboardingSchema, type OnboardingValues } from '@/features/onboarding/schema';
import { onboardingSteps } from '@/features/onboarding/steps';
import { useSession } from '@/stores/session';

export function Onboarding() {
  const completeOnboarding = useSession((state) => state.completeOnboarding);
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Partial<OnboardingValues>>({});
  const [error, setError] = useState<string | null>(null);
  const step = onboardingSteps[index];

  async function choose(value: OnboardingValues[keyof OnboardingValues]) {
    if (!step) return;
    const next = { ...values, [step.field]: value };
    setValues(next);
    setError(null);
    if (index < onboardingSteps.length - 1) {
      setIndex(index + 1);
      return;
    }
    const parsed = onboardingSchema.safeParse(next);
    if (!parsed.success) {
      setError('Faltou alguma resposta.');
      return;
    }
    try {
      await completeOnboarding(parsed.data);
      navigate('/inicio');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível guardar o plano.');
    }
  }

  if (!step) return null;

  return (
    <main className="screen">
      <div className="row-between">
        <button className="back" type="button" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>
          Voltar
        </button>
        <p className="eyebrow">
          {index + 1} DE {onboardingSteps.length}
        </p>
      </div>
      <div>
        <h1>{step.title}</h1>
        <p className="muted">{step.subtitle}</p>
      </div>
      <div className="options">
        {step.options.map((option) => {
          const selected = values[step.field] === option.value;
          return (
            <button key={String(option.value)} className={selected ? 'option selected' : 'option'} type="button" onClick={() => void choose(option.value)}>
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
