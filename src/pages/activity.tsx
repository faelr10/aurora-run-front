import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ActivityEditor } from '@/components/activity-editor';
import { RouteMap } from '@/components/route-map';
import { StageList } from '@/components/stage-list';
import { bestSplits, renderShareCard, type ShareVariant } from '@/features/share/card';
import { useActivity } from '@/hooks/use-live-activity';
import { deleteFirebaseActivity } from '@/services/firebase/activities';
import { deleteActivity, forgetDeleted, rememberDeleted } from '@/services/storage/database';
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [card, setCard] = useState<{ url: string; file: File } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [variant, setVariant] = useState<ShareVariant>('summary');

  async function share(nextVariant: ShareVariant = variant) {
    if (!activity || sharing) return;
    setSharing(true);
    setShareError(null);
    setVariant(nextVariant);
    try {
      const blob = await renderShareCard(activity, nextVariant);
      const file = new File([blob], 'aurora-corrida.png', { type: 'image/png' });
      setCard((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { url: URL.createObjectURL(blob), file };
      });
    } catch (cause) {
      setShareError(cause instanceof Error ? cause.message : 'Não foi possível gerar a imagem.');
    } finally {
      setSharing(false);
    }
  }

  function closeShare() {
    setCard((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function publish() {
    if (!card) return;
    if (navigator.canShare?.({ files: [card.file] })) {
      try {
        await navigator.share({ files: [card.file], title: activity?.title ?? 'Aurora Run' });
      } catch {
        // The share sheet was dismissed.
      }
      return;
    }
    saveImage();
  }

  function saveImage() {
    if (!card) return;
    const link = document.createElement('a');
    link.href = card.url;
    link.download = card.file.name;
    link.click();
  }

  async function remove() {
    if (!activity || removing) return;
    setRemoving(true);
    rememberDeleted(activity.clientId);
    try {
      await deleteActivity(activity.clientId);
      const removed = await deleteFirebaseActivity(activity.clientId).catch(() => false);
      if (removed) forgetDeleted(activity.clientId);
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
      navigate('/evolucao');
    } catch (cause) {
      setShareError(cause instanceof Error ? cause.message : 'Não foi possível excluir a corrida.');
      setRemoving(false);
    }
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
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setEditing(true);
                }}
              >
                Editar corrida
              </button>
              <button type="button" className="danger" disabled={removing} onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}>
                {removing ? 'Excluindo...' : confirmDelete ? 'Confirmar exclusão' : 'Excluir corrida'}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {query.isPending ? <p className="muted">Carregando corrida.</p> : null}
      {!query.isPending && !activity ? <p className="muted">Essa corrida não está neste aparelho.</p> : null}
      {activity ? <SummaryBody activity={activity} sharing={sharing} onShare={() => void share()} /> : null}
      {shareError ? <p className="error">{shareError}</p> : null}
      {editing && activity ? (
        <ActivityEditor
          activity={activity}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: ['activity', activity.clientId] });
            void queryClient.invalidateQueries({ queryKey: ['activities'] });
          }}
        />
      ) : null}
      {card ? (
        <div className="share-sheet" role="dialog" aria-label="Imagem para o Instagram">
          <img src={card.url} alt="Imagem da corrida para publicar" />
          <div>
            {activity && bestSplits(activity).length ? (
              <div className="share-variants" role="group" aria-label="Modelo da imagem">
                {(
                  [
                    ['summary', 'Resumo'],
                    ['best', 'Melhores kms'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={value === variant ? 'on' : undefined}
                    type="button"
                    aria-pressed={value === variant}
                    disabled={sharing}
                    onClick={() => void share(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <button className="btn primary" type="button" onClick={() => void publish()}>
              Enviar para o Instagram
            </button>
            <button className="btn outline" type="button" onClick={saveImage}>
              Salvar imagem
            </button>
            <button className="btn text" type="button" onClick={closeShare}>
              Fechar
            </button>
            <p>No celular, escolha o Instagram na lista que abrir.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SummaryBody({ activity, sharing, onShare }: { activity: Activity; sharing: boolean; onShare: () => void }) {
  const date = formatRunDate(activity.startedAt);
  const fastestKm = bestSplits(activity)[0]?.kilometer;

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
      {activity.stages && activity.stages.length > 0 ? (
        <section className="summary-card stage-card">
          <strong>Etapas</strong>
          <StageList stages={activity.stages} />
        </section>
      ) : null}
      <section className="summary-card partials-card">
        <header>
          <i aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 16v3M12 10v9M19 6v13" />
            </svg>
          </i>
          <strong>Parciais por km</strong>
          {activity.splits.length > 0 ? <span>min/km</span> : null}
        </header>
        {activity.splits.length > 0 ? (
          <ul>
            {activity.splits.map((split) => (
              <li key={split.kilometer} className={split.kilometer === fastestKm ? 'best' : undefined}>
                <span>KM {split.kilometer}</span>
                <b>{formatPace(split.paceSecondsPerKm)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aparecem a partir do primeiro km completo.</p>
        )}
      </section>
      <button className="summary-share" type="button" onClick={onShare} disabled={sharing}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V5" />
          <path d="m8 8 4-4 4 4" />
          <path d="M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5" />
        </svg>
        {sharing ? 'Gerando imagem...' : 'Compartilhar no Instagram'}
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
