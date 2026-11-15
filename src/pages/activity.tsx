import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { RouteMap } from '@/components/route-map';
import { useActivity } from '@/hooks/use-live-activity';
import { deleteActivity } from '@/services/storage/database';
import type { Activity } from '@/types/domain';
import { formatClock, formatDistanceKm, formatPace, formatWeekday, parseDateKey } from '@/utils/format';

export function ActivityDone() {
  return <RunSummary />;
}

export function ActivityDetail() {
  return <RunSummary />;
}

function RunSummary() {
  const { activityId = '' } = useParams();
  const query = useActivity(activityId);
  const activity = query.data;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState(false);

  async function share() {
    if (!activity) return;
    const text = `${activity.title}: ${formatDistanceKm(activity.distanceMeters)} km em ${formatClock(activity.movingSeconds)}, ritmo ${formatPace(activity.averagePaceSecondsPerKm)}/km.`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: activity.title, text });
      } catch {
        // The share sheet was dismissed.
      }
      return;
    }
    await navigator.clipboard?.writeText(text);
  }

  async function remove() {
    if (!activity) return;
    await deleteActivity(activity.clientId);
    await queryClient.invalidateQueries({ queryKey: ['activities'] });
    navigate('/evolucao');
  }

  return (
    <main className="screen summary">
      <header className="summary-head">
        <button className="summary-icon" type="button" onClick={() => navigate('/evolucao')} aria-label="Voltar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 6.5 9 12l5.5 5.5" />
          </svg>
        </button>
        <p>EVOLUÇÃO</p>
        <div className="summary-more">
          <button className="summary-icon" type="button" aria-label="Mais opções" aria-expanded={menu} onClick={() => setMenu((open) => !open)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="6" cy="12" r="1.3" />
              <circle cx="12" cy="12" r="1.3" />
              <circle cx="18" cy="12" r="1.3" />
            </svg>
          </button>
          {menu ? (
            <div className="summary-menu">
              <button type="button" onClick={() => void remove()}>
                Excluir corrida
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {query.isPending ? <p className="muted">Carregando corrida.</p> : null}
      {!query.isPending && !activity ? <p className="muted">Essa corrida não está neste aparelho.</p> : null}
      {activity ? <SummaryBody activity={activity} onShare={() => void share()} /> : null}
    </main>
  );
}

function SummaryBody({ activity, onShare }: { activity: Activity; onShare: () => void }) {
  const date = formatRunDate(activity.startedAt);

  return (
    <>
      <div className="summary-title">
        <p>{date}</p>
        <h1>{activity.title}</h1>
      </div>
      <div className="summary-map">
        <RouteMap points={activity.points} dark ends height="fill" />
        <p className="map-legend">
          <span>
            <i className="start" />
            Início
          </span>
          <span>
            <i className="end" />
            Fim
          </span>
        </p>
      </div>
      <section className="summary-card">
        <p className="summary-distance">
          {formatDistanceKm(activity.distanceMeters)}
          <small>km</small>
        </p>
        <div className="summary-stats">
          <div>
            <span>Tempo</span>
            <strong>{formatClock(activity.movingSeconds)}</strong>
          </div>
          <div>
            <span>Ritmo</span>
            <strong>
              {formatPace(activity.averagePaceSecondsPerKm)}
              <em>/km</em>
            </strong>
          </div>
          <div>
            <span>Calorias</span>
            <strong>
              {activity.calories}
              <em>kcal</em>
            </strong>
          </div>
        </div>
      </section>
      <section className="summary-card partials-card">
        <i aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 16v3M12 10v9M19 6v13" />
          </svg>
        </i>
        <div>
          <strong>Parciais por km</strong>
          {activity.splits.length > 0 ? (
            <ul>
              {activity.splits.map((split) => (
                <li key={split.kilometer}>
                  <span>km {split.kilometer}</span>
                  <b>{formatPace(split.paceSecondsPerKm)}/km</b>
                </li>
              ))}
            </ul>
          ) : (
            <p>Aparecem a partir do primeiro km completo.</p>
          )}
        </div>
      </section>
      <button className="summary-share" type="button" onClick={onShare}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V5" />
          <path d="m8 8 4-4 4 4" />
          <path d="M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5" />
        </svg>
        Compartilhar corrida
      </button>
    </>
  );
}

function formatRunDate(iso: string): string {
  const key = iso.slice(0, 10);
  const date = parseDateKey(key);
  const month = date.toLocaleDateString('pt-BR', { month: 'long' });
  return `${formatWeekday(key)}, ${date.getDate()} de ${month}`;
}

export function Notifications() {
  return (
    <main className="screen plain">
      <Link className="back" to="/inicio">
        Início
      </Link>
      <h1>Avisos</h1>
      <p className="muted">Nenhum aviso por enquanto.</p>
    </main>
  );
}
