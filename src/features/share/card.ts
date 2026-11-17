import logoUrl from '../../../logo-sem-fundo.png';
import runnerUrl from '../../../share-bg-runner.jpg';

import type { Activity, Split } from '@/types/domain';
import { formatClock, formatDistanceKm, formatPace, parseDateKey } from '@/utils/format';

export type ShareVariant = 'summary' | 'best';

const WIDTH = 1080;
const HEIGHT = 1920;
const MARGIN = 72;
const FONT = '"Plus Jakarta Sans", sans-serif';
const WHITE = '#f4f7f5';
const GRAY = '#8d9791';
const LIME = '#d6ff3e';
const LINE = '#262c29';
const RUNNER_CROP = { x: 60, y: 260, width: 600, height: 540 };
const RUNNER_ANCHOR = 0.54;

export function bestSplits(activity: Activity): Split[] {
  return activity.splits
    .filter((split) => split.durationSeconds > 0)
    .sort((a, b) => a.durationSeconds - b.durationSeconds)
    .slice(0, 3);
}

export async function renderShareCard(activity: Activity, variant: ShareVariant = 'summary'): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível gerar a imagem.');
  await document.fonts?.ready;
  const [logo, runner] = await Promise.all([loadImage(logoUrl), loadImage(runnerUrl)]);
  const best = variant === 'best' ? bestSplits(activity) : [];
  context.fillStyle = '#000';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawHeader(context, logo, activity);
  if (best.length) {
    drawRunner(context, runner, 820, 200);
    drawStats(context, activity, 1010);
    drawBestSplits(context, best, 1490);
  } else {
    drawRunner(context, runner, 960, 280);
    drawStats(context, activity, 1330);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível gerar a imagem.');
  return blob;
}

function drawHeader(context: CanvasRenderingContext2D, logo: HTMLImageElement, activity: Activity): void {
  const logoSize = 104;
  context.drawImage(logo, MARGIN - 10, 72, logoSize, logoSize);
  context.textBaseline = 'middle';
  context.fillStyle = WHITE;
  context.font = `800 46px ${FONT}`;
  withSpacing(context, '5px', () => context.fillText('AURORA RUN', MARGIN + 116, 126));
  context.fillStyle = GRAY;
  context.font = `600 30px ${FONT}`;
  context.textAlign = 'right';
  withSpacing(context, '2px', () => context.fillText(shareDate(activity.startedAt), WIDTH - MARGIN, 126));
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
}

function drawRunner(context: CanvasRenderingContext2D, runner: HTMLImageElement, width: number, top: number): void {
  const scaleX = runner.width / 720;
  const scaleY = runner.height / 1280;
  const height = (width * RUNNER_CROP.height) / RUNNER_CROP.width;
  context.drawImage(
    runner,
    RUNNER_CROP.x * scaleX,
    RUNNER_CROP.y * scaleY,
    RUNNER_CROP.width * scaleX,
    RUNNER_CROP.height * scaleY,
    WIDTH / 2 - width * RUNNER_ANCHOR,
    top,
    width,
    height,
  );
}

function drawStats(context: CanvasRenderingContext2D, activity: Activity, top: number): void {
  context.fillStyle = GRAY;
  context.font = `600 30px ${FONT}`;
  withSpacing(context, '2px', () => context.fillText(trim(context, activity.title.toUpperCase(), WIDTH - MARGIN * 2), MARGIN, top));
  const distance = formatDistanceKm(activity.distanceMeters);
  context.fillStyle = WHITE;
  context.font = `700 132px ${FONT}`;
  context.fillText(distance, MARGIN, top + 150);
  const distanceWidth = context.measureText(distance).width;
  context.fillStyle = LIME;
  context.font = `700 64px ${FONT}`;
  context.fillText('km', MARGIN + distanceWidth + 22, top + 150);
  drawLine(context, top + 215);
  const columns: Array<[string, string, string?]> = [
    ['TEMPO', shortClock(activity.movingSeconds)],
    ['RITMO MÉDIO', formatPace(activity.averagePaceSecondsPerKm), ' /km'],
    ['CALORIAS', String(activity.calories)],
  ];
  columns.forEach(([label, value, unit], index) => {
    const x = MARGIN + index * 360;
    context.fillStyle = GRAY;
    context.font = `600 28px ${FONT}`;
    withSpacing(context, '2px', () => context.fillText(label, x, top + 305));
    context.fillStyle = WHITE;
    context.font = `600 62px ${FONT}`;
    context.fillText(value, x, top + 380);
    if (!unit) return;
    const valueWidth = context.measureText(value).width;
    context.font = `600 36px ${FONT}`;
    context.fillText(unit, x + valueWidth, top + 380);
  });
}

function drawBestSplits(context: CanvasRenderingContext2D, splits: Split[], top: number): void {
  context.fillStyle = GRAY;
  context.font = `600 28px ${FONT}`;
  withSpacing(context, '2px', () => context.fillText('MELHORES KMS', MARGIN, top));
  splits.forEach((split, index) => {
    const y = top + 85 + index * 95;
    if (index > 0) drawLine(context, y - 60);
    context.fillStyle = GRAY;
    context.font = `500 36px ${FONT}`;
    context.fillText(`${index + 1}º`, MARGIN, y);
    context.fillText(`KM ${split.kilometer}`, MARGIN + 88, y);
    context.fillStyle = index === 0 ? LIME : WHITE;
    context.font = `600 42px ${FONT}`;
    context.textAlign = 'right';
    context.fillText(formatPace(split.durationSeconds), WIDTH - MARGIN, y);
    context.textAlign = 'left';
  });
}

function drawLine(context: CanvasRenderingContext2D, y: number): void {
  context.fillStyle = LINE;
  context.fillRect(MARGIN, y, WIDTH - MARGIN * 2, 2);
}

function withSpacing(context: CanvasRenderingContext2D, spacing: string, draw: () => void): void {
  const previous = context.letterSpacing;
  context.letterSpacing = spacing;
  draw();
  context.letterSpacing = previous;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    image.src = src;
  });
}

function shortClock(totalSeconds: number): string {
  return formatClock(totalSeconds).replace(/^00:/, '').replace(/^0(?=\d)/, '');
}

function shareDate(iso: string): string {
  const date = parseDateKey(iso.slice(0, 10));
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${date.getDate()} ${month} ${date.getFullYear()}`.toUpperCase();
}

function trim(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && context.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}
