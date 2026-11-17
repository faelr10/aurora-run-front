import { stageNote } from '@/features/training/engine';
import type { ActivityStage } from '@/types/domain';

export function StageList({ stages }: { stages: ActivityStage[] }) {
  if (stages.length === 0) return null;
  return (
    <ol className="stage-log">
      {stages.map((stage) => (
        <li key={stage.id} className={[stage.kind, stage.status, stage.onTarget === false ? 'miss' : ''].filter(Boolean).join(' ')}>
          <span>{stage.label}</span>
          <b>{stageNote(stage)}</b>
        </li>
      ))}
    </ol>
  );
}
