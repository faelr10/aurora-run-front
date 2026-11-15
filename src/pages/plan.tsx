import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Locked } from '@/components/locked';
import { buildPlan, planProgress, sessionOn, timeline, WEEKDAY_LABELS, weekDates } from '@/features/training/plan';
import { useSession } from '@/stores/session';
import { formatDistanceKm, formatDuration, parseDateKey, toDateKey } from '@/utils/format';

export function Plan() {
  const profile = useSession((state) => state.profile);
  const [selected, setSelected] = useState(toDateKey(new Date()));
  const sessions = useMemo(() => (profile ? buildPlan(profile) : []), [profile]);
  const days = weekDates();
  const session = sessionOn(sessions, selected);
  const upcoming = sessions.filter((item) => item.date > selected).slice(0, 3);
  const progress = profile ? planProgress(profile) : null;

  if (!profile) {
    return (
      <main className="screen">
        <div>
          <p className="brand">PLANO DE TREINO</p>
          <h1>Esta semana</h1>
        </div>
        <Locked title="Plano bloqueado" message="O plano de corrida fica fechado enquanto não houver um treino vinculado." />
      </main>
    );
  }

  return (
    <main className="screen">
      <div>
        <p className="brand">PLANO DE TREINO</p>
        <h1>Esta semana</h1>
      </div>
      {progress ? (
        <p className="section-label muted-label">
          SEMANA {progress.week} DE {progress.total}
        </p>
      ) : null}
      <div className="week">
        {days.map((date, index) => {
          const active = date === selected;
          return (
            <button key={date} className={active ? 'day active' : 'day'} type="button" onClick={() => setSelected(date)}>
              <span>{WEEKDAY_LABELS[index]}</span>
              <strong>{parseDateKey(date).getDate()}</strong>
            </button>
          );
        })}
      </div>

      {session ? (
        <section className="block">
          <div className="row-between">
            <div>
              <p className="eyebrow">TREINO DO DIA</p>
              <h2>{session.title}</h2>
            </div>
            <p className="section-label">
              {session.distanceMeters ? `${formatDistanceKm(session.distanceMeters, 1)} KM` : formatDuration(session.durationSeconds ?? 0).toUpperCase()}
            </p>
          </div>
          <p className="muted">{session.objective}</p>
          <ol className="steps">
            {timeline(session).map((item, index) => (
              <li key={`${item.label}-${item.detail}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link className="btn primary" to={`/treino/${session.id}`}>
            Ver detalhes do treino
          </Link>
        </section>
      ) : (
        <section className="block">
          <h2>Descanso</h2>
          <p className="muted">Hoje o corpo assimila o treino. A próxima sessão está logo abaixo.</p>
        </section>
      )}

      <p className="brand">PRÓXIMOS TREINOS</p>
      {upcoming.length === 0 ? <p className="muted">Não há treinos depois deste dia no plano atual.</p> : null}
      {upcoming.map((item) => (
        <Link key={item.id} className="next" to={`/treino/${item.id}`}>
          <div className="next-date">
            <strong>{parseDateKey(item.date).getDate()}</strong>
            <span>{parseDateKey(item.date).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
          </div>
          <div>
            <strong>{item.title}</strong>
            <p className="muted">{item.distanceMeters ? `${formatDistanceKm(item.distanceMeters, 1)} km` : formatDuration(item.durationSeconds ?? 0)}</p>
          </div>
        </Link>
      ))}
    </main>
  );
}
