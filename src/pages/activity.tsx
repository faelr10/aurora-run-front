import { Link, useNavigate, useParams } from 'react-router-dom';

import { RouteMap } from '@/components/route-map';
import { useActivity } from '@/hooks/use-live-activity';
import { formatClock, formatDayMonth, formatDistanceKm, formatPace } from '@/utils/format';

export function ActivityDone() {
  const { activityId = '' } = useParams();
  const query = useActivity(activityId);
  const activity = query.data;
  const navigate = useNavigate();

  return (
    <main className="screen plain">
      {query.isPending ? <p className="muted">Salvando a corrida.</p> : null}
      {activity ? (
        <>
          <p className="eyebrow">ATIVIDADE SALVA NESTE APARELHO</p>
          <h1>Corrida concluída</h1>
          <RouteMap points={activity.points} height={220} />
          <section className="metrics">
            <div>
              <p className="metric-value">
                {formatDistanceKm(activity.distanceMeters)}
                <small>KM</small>
              </p>
              <p className="metric-label">DISTÂNCIA</p>
            </div>
            <div>
              <p className="metric-value">{formatClock(activity.movingSeconds)}</p>
              <p className="metric-label">TEMPO</p>
            </div>
            <div>
              <p className="metric-value">
                {formatPace(activity.averagePaceSecondsPerKm)}
                <small>/KM</small>
              </p>
              <p className="metric-label">RITMO</p>
            </div>
          </section>
          {activity.splits.length > 0 ? (
            <section className="splits">
              <p className="section-label">RITMO POR QUILÔMETRO</p>
              {activity.splits.slice(0, 8).map((split) => {
                const max = Math.max(...activity.splits.map((item) => item.paceSecondsPerKm));
                const width = Math.max(28, Math.round((split.paceSecondsPerKm / Math.max(max, 1)) * 100));
                return (
                  <div key={split.kilometer} className="split-row">
                    <span>{split.kilometer}</span>
                    <i>
                      <b style={{ width: `${width}%` }} />
                    </i>
                    <strong>{formatPace(split.paceSecondsPerKm)}</strong>
                  </div>
                );
              })}
            </section>
          ) : null}
          <p className="calories">{activity.calories} KCAL ESTIMADAS</p>
          <button className="btn primary" type="button" onClick={() => navigate(`/atividade/${activity.clientId}`)}>
            Salvar atividade
          </button>
          <button className="btn text" type="button" onClick={() => navigate('/inicio')}>
            Voltar para o início
          </button>
        </>
      ) : null}
    </main>
  );
}

export function ActivityDetail() {
  const { activityId = '' } = useParams();
  const query = useActivity(activityId);
  const activity = query.data;

  return (
    <main className="screen plain">
      <Link className="back" to="/evolucao">
        Evolução
      </Link>
      {query.isPending ? <p className="muted">Carregando corrida.</p> : null}
      {!query.isPending && !activity ? <p className="muted">Essa corrida não está neste aparelho.</p> : null}
      {activity ? (
        <>
          <div>
            <p className="eyebrow">{formatDayMonth(activity.startedAt.slice(0, 10)).toUpperCase()}</p>
            <h1>{activity.title}</h1>
          </div>
          <RouteMap points={activity.points} height={240} />
          <section className="metrics">
            <div>
              <p className="metric-value">
                {formatDistanceKm(activity.distanceMeters)}
                <small>KM</small>
              </p>
              <p className="metric-label">DISTÂNCIA</p>
            </div>
            <div>
              <p className="metric-value">{formatClock(activity.movingSeconds)}</p>
              <p className="metric-label">TEMPO</p>
            </div>
            <div>
              <p className="metric-value">{formatPace(activity.averagePaceSecondsPerKm)}</p>
              <p className="metric-label">RITMO</p>
            </div>
          </section>
          <p className="calories">{activity.calories} KCAL ESTIMADAS</p>
        </>
      ) : null}
    </main>
  );
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
