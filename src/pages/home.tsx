import { Link, useNavigate } from 'react-router-dom';

import { totals } from '@/features/history/stats';
import { useActivities, useRecording } from '@/hooks/use-live-activity';
import { primeLocation } from '@/services/location';
import { useSession } from '@/stores/session';
import { formatDistanceKm, formatDuration, formatWeekday, mondayOf, parseDateKey, toDateKey } from '@/utils/format';

const WEEK_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export function Home() {
  const name = useSession((state) => state.name);
  const mode = useSession((state) => state.mode);
  const profile = useSession((state) => state.profile);
  const hasAccount = mode === 'local' || mode === 'remote' || mode === 'firebase';
  const planPath = !hasAccount ? '/criar-conta' : profile?.plan?.stages?.length ? '/plano' : '/avaliacao';
  const activities = useActivities();
  const recording = useRecording();
  const navigate = useNavigate();
  const firstName = name?.split(' ')[0];
  const initial = (firstName ?? 'A').slice(0, 1).toUpperCase();
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekStart = mondayOf(parseDateKey(todayKey));
  const todayIndex = Math.round((parseDateKey(todayKey).getTime() - weekStart.getTime()) / 86_400_000);
  const weekActivities = (activities.data ?? []).filter((activity) => new Date(activity.startedAt).getTime() >= weekStart.getTime());
  const summary = totals(weekActivities);
  const paused = recording.data?.status === 'paused';
  const open = Boolean(recording.data);

  function resume() {
    primeLocation();
    if (recording.data?.source === 'guided' && recording.data.sessionId) {
      navigate(`/treino/${recording.data.sessionId}/guiado`);
      return;
    }
    navigate('/corrida');
  }

  return (
    <main className="screen home">
      <header className="home-top">
        <div className="avatar" aria-hidden="true">
          {initial}
        </div>
        <div>
          <strong>{capitalize(formatWeekday(todayKey))}</strong>
          <p>{longDayMonth(todayKey)}</p>
        </div>
        <Link className="bell" to="/avisos" aria-label="Avisos">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 0 0 4 0" />
          </svg>
        </Link>
      </header>

      {open ? (
        <section className="resume-card">
          <p className="pill">{paused ? 'Pausada' : 'Em movimento'}</p>
          <h2>{paused ? 'Sua corrida ficou pela metade.' : 'Sua corrida está aberta.'}</h2>
          <p>{paused ? 'Retome de onde parou e feche o treino.' : 'Continue de onde parou e feche o treino.'}</p>
          <button className="resume" type="button" onClick={resume}>
            {paused ? 'Retomar corrida' : 'Continuar corrida'}
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M9 7.2v9.6L17.5 12z" />
              </svg>
            </span>
          </button>
        </section>
      ) : (
        <section className="resume-card">
          <p className="pill">Agora</p>
          <h2>Pronto para sair.</h2>
          <p>Sem plano e sem meta. A corrida começa quando você começar.</p>
          <button
            className="resume"
            type="button"
            onClick={() => {
              primeLocation();
              navigate('/corrida');
            }}
          >
            Começar corrida
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M9 7.2v9.6L17.5 12z" />
              </svg>
            </span>
          </button>
        </section>
      )}

      <div className="shortcuts">
        <Link className="shortcut" to={planPath}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M8 3.5v3M16 3.5v3M4 10h16" />
          </svg>
          <strong>Monte seu plano</strong>
          <span>Treinos guiados em 2 minutos.</span>
        </Link>
        <Link className="shortcut" to="/corrida" onClick={() => primeLocation()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="6" cy="17" r="2.2" />
            <circle cx="17" cy="7" r="2.2" />
            <path d="M8 16.2C10 12 13 10 15.2 8.6" />
          </svg>
          <strong>Só correr</strong>
          <span>Sem plano, sem meta, no seu ritmo.</span>
        </Link>
      </div>

      <section className="week-card">
        <div className="row-between">
          <h2>Sua semana</h2>
          <Link className="see-all" to="/evolucao">
            Ver tudo
            <i />
          </Link>
        </div>
        <div className="week-letters">
          {WEEK_LETTERS.map((letter, index) => (
            <span key={`${letter}-${index}`} className={index === todayIndex ? 'today' : undefined}>
              {letter}
            </span>
          ))}
        </div>
        <div className="week-metrics">
          <div>
            <strong>
              {formatDistanceKm(summary.distanceMeters, 1)} <small>km</small>
            </strong>
            <span>distância</span>
          </div>
          <div>
            <strong>{summary.count}</strong>
            <span>corridas</span>
          </div>
          <div>
            <strong>{formatDuration(summary.movingSeconds)}</strong>
            <span>em movimento</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function longDayMonth(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const month = date.toLocaleDateString('pt-BR', { month: 'long' });
  return `${date.getDate()} de ${month}`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
