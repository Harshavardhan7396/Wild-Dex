import { formatRaritySimple } from '../services/lifeListService';
import {
  YearReviewData,
  formatCategoryLabel,
  loadScanImageForCanvas,
} from '../services/yearReviewService';

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const boxRatio = w / Math.max(1, h);

  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (imgRatio > boxRatio) {
    sw = img.naturalHeight * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / boxRatio;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawTruncatedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  ctx.fillText(`${clipped}…`, x, y);
}

function drawWildDexLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  // Forest green rounded emblem matching Header.tsx
  drawRoundedRectPath(ctx, x, y, size, size, size * 0.28);
  ctx.fillStyle = '#1b5e20';
  ctx.fill();

  // Stylized twin pine tree silhouette inside the emblem
  ctx.fillStyle = '#ffffff';

  const cx = x + size * 0.44;
  const baseY = y + size * 0.79;

  // Main pine triangle tiers
  ctx.beginPath();
  ctx.moveTo(cx, y + size * 0.19);
  ctx.lineTo(cx + size * 0.21, y + size * 0.48);
  ctx.lineTo(cx + size * 0.11, y + size * 0.48);
  ctx.lineTo(cx + size * 0.25, y + size * 0.72);
  ctx.lineTo(cx - size * 0.25, y + size * 0.72);
  ctx.lineTo(cx - size * 0.11, y + size * 0.48);
  ctx.lineTo(cx - size * 0.21, y + size * 0.48);
  ctx.closePath();
  ctx.fill();

  // Trunk
  ctx.fillRect(cx - size * 0.045, y + size * 0.71, size * 0.09, baseY - (y + size * 0.71));

  // Secondary smaller pine
  const sx = x + size * 0.72;
  ctx.beginPath();
  ctx.moveTo(sx, y + size * 0.34);
  ctx.lineTo(sx + size * 0.14, y + size * 0.68);
  ctx.lineTo(sx - size * 0.14, y + size * 0.68);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(sx - size * 0.03, y + size * 0.67, size * 0.06, baseY - (y + size * 0.67));
}

interface CardMetric {
  value: string;
  label: string;
  accent: string;
}

function pickTopThreeMetrics(data: YearReviewData): CardMetric[] {
  const candidates: CardMetric[] = [];

  if (data.sightings !== null) {
    candidates.push({
      value: String(data.sightings),
      label: data.sightings === 1 ? 'Sighting' : 'Sightings',
      accent: '#00450d',
    });
  }
  if (data.species !== null) {
    candidates.push({
      value: String(data.species),
      label: data.species === 1 ? 'Species' : 'Species',
      accent: '#126d27',
    });
  }
  if (data.newSpecies !== null) {
    candidates.push({
      value: String(data.newSpecies),
      label: 'New to you',
      accent: '#711b00',
    });
  }

  if (candidates.length < 3 && data.months.length > 0 && data.busiestMonth !== null) {
    const busiestEntry = data.months.find((m) => m.month === data.busiestMonth);
    if (busiestEntry) {
      candidates.push({
        value: String(busiestEntry.count),
        label: busiestEntry.shortLabel,
        accent: '#00450d',
      });
    }
  }

  return candidates.slice(0, 3);
}

export async function generateYearReviewCardBlob(
  data: YearReviewData,
  safeUsername: string
): Promise<Blob> {
  const WIDTH = 1080;
  const HEIGHT = 1350;

  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 400)),
      ]);
    }
  } catch {
    // Proceed cleanly with system fallback fonts if FontFaceSet check fails
  }

  const rarestImg =
    data.rarest && (data.rarest.photoPath || data.rarest.photoUrl)
      ? await loadScanImageForCanvas(data.rarest.photoPath, data.rarest.photoUrl)
      : null;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create summary image on this device.');
  }

  // 1. Background canvas (WildDex warm cream surface)
  ctx.fillStyle = '#fef9ef';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Soft botanical geometric arcs
  ctx.save();
  ctx.fillStyle = '#edf3e8';
  ctx.beginPath();
  ctx.arc(WIDTH + 40, 120, 420, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f2ede3';
  ctx.beginPath();
  ctx.arc(-60, HEIGHT - 90, 340, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Outer card frame
  const PAD = 64;
  drawRoundedRectPath(ctx, 32, 32, WIDTH - 64, HEIGHT - 64, 44);
  ctx.strokeStyle = '#c0c9bb';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Top Brand Row (Logo + WildDex + Year)
  drawWildDexLogo(ctx, PAD, 78, 72);

  ctx.fillStyle = '#00450d';
  ctx.font = '700 36px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('WildDex', PAD + 92, 118);

  ctx.fillStyle = '#41493e';
  ctx.font = '600 22px Inter, system-ui, sans-serif';
  ctx.fillText('Year in Review', PAD + 92, 148);

  // Year badge on top right
  const yearText = String(data.year);
  drawRoundedRectPath(ctx, WIDTH - PAD - 178, 80, 178, 68, 34);
  ctx.fillStyle = '#00450d';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(yearText, WIDTH - PAD - 89, 127);
  ctx.textAlign = 'left';

  // Hero Headline
  ctx.fillStyle = '#1d1c16';
  ctx.font = '700 54px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`${data.year} in the field`, PAD, 248);

  if (data.topCategory) {
    ctx.fillStyle = '#41493e';
    ctx.font = '500 28px Inter, system-ui, sans-serif';
    drawTruncatedText(
      ctx,
      `Favorite group: ${formatCategoryLabel(data.topCategory)}`,
      PAD,
      294,
      WIDTH - PAD * 2
    );
  }

  // 3. The Three Biggest Numbers
  const metrics = pickTopThreeMetrics(data);
  const metricTopY = 344;
  const metricHeight = 204;
  const metricGap = 20;
  const totalMetricWidth = WIDTH - PAD * 2;
  const count = Math.max(1, metrics.length);
  const colWidth = (totalMetricWidth - metricGap * (count - 1)) / count;

  metrics.forEach((metric, index) => {
    const mx = PAD + index * (colWidth + metricGap);
    drawRoundedRectPath(ctx, mx, metricTopY, colWidth, metricHeight, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#d3dbcf';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = metric.accent;
    ctx.font = '700 72px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(metric.value, mx + 28, metricTopY + 106);

    ctx.fillStyle = '#41493e';
    ctx.font = '600 26px Inter, system-ui, sans-serif';
    drawTruncatedText(ctx, metric.label, mx + 28, metricTopY + 158, colWidth - 56);
  });

  // 4. Rarest Find Card (Photo + Name)
  const rarestTopY = 586;
  const rarestHeight = 560;
  const rarestWidth = WIDTH - PAD * 2;

  drawRoundedRectPath(ctx, PAD, rarestTopY, rarestWidth, rarestHeight, 34);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#d3dbcf';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (data.rarest) {
    const imgX = PAD + 24;
    const imgY = rarestTopY + 24;
    const imgW = rarestWidth - 48;
    const imgH = 382;

    ctx.save();
    drawRoundedRectPath(ctx, imgX, imgY, imgW, imgH, 24);
    ctx.clip();

    if (rarestImg) {
      drawCoverImage(ctx, rarestImg, imgX, imgY, imgW, imgH);
    } else {
      ctx.fillStyle = '#ede8de';
      ctx.fillRect(imgX, imgY, imgW, imgH);

      // Subtle botanical leaf mark when image is unavailable
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath();
      ctx.ellipse(imgX + imgW / 2, imgY + imgH / 2, 44, 72, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const rarityLabel = formatRaritySimple(data.rarest.rarity).label;

    ctx.fillStyle = '#711b00';
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(`Rarest find · ${rarityLabel}`, PAD + 32, rarestTopY + 454);

    ctx.fillStyle = '#1d1c16';
    ctx.font = '700 44px "Plus Jakarta Sans", system-ui, sans-serif';
    drawTruncatedText(
      ctx,
      data.rarest.name,
      PAD + 32,
      rarestTopY + 514,
      rarestWidth - 64
    );
  } else {
    ctx.fillStyle = '#f8f3e9';
    drawRoundedRectPath(ctx, PAD + 24, rarestTopY + 24, rarestWidth - 48, rarestHeight - 48, 24);
    ctx.fill();

    ctx.fillStyle = '#00450d';
    ctx.font = '700 38px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      data.busiestMonthName
        ? `Busiest month: ${data.busiestMonthName}`
        : `${data.year} Field Journal`,
      WIDTH / 2,
      rarestTopY + rarestHeight / 2 + 12
    );
    ctx.textAlign = 'left';
  }

  // 5. Bottom Footer (Username only — no email or location)
  const footerY = 1236;
  ctx.fillStyle = '#1d1c16';
  ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
  drawTruncatedText(ctx, safeUsername || 'Explorer', PAD, footerY, WIDTH - PAD * 2 - 220);

  ctx.fillStyle = '#41493e';
  ctx.font = '500 22px Inter, system-ui, sans-serif';
  ctx.fillText('Created on device with WildDex', PAD, footerY + 38);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Could not build PNG image.'));
        }
      },
      'image/png',
      1
    );
  });
}
