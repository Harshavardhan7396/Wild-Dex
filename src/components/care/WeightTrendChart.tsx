import React, { useMemo } from 'react';
import { CareEntry, formatEntryDate } from '../../services/careService';

interface WeightTrendChartProps {
  entries: CareEntry[];
}

function convertWeight(
  value: number,
  fromUnit: string,
  toUnit: 'kg' | 'lb'
): number {
  const normalizedFrom = fromUnit === 'lb' ? 'lb' : 'kg';
  if (normalizedFrom === toUnit) return value;
  return toUnit === 'lb' ? value * 2.20462 : value / 2.20462;
}

export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({
  entries,
}) => {
  const points = useMemo(() => {
    const valid = entries.filter(
      (e) => e.value !== null && Number.isFinite(e.value)
    );
    if (valid.length === 0) return null;

    const latest = valid[valid.length - 1];
    const displayUnit: 'kg' | 'lb' = latest.unit === 'lb' ? 'lb' : 'kg';

    const converted = valid.map((e) => ({
      id: e.id,
      date: e.entryDate,
      rawValue: e.value as number,
      rawUnit: (e.unit === 'lb' ? 'lb' : 'kg') as 'kg' | 'lb',
      plotValue: Number(
        convertWeight(e.value as number, e.unit, displayUnit).toFixed(2)
      ),
    }));

    const values = converted.map((p) => p.plotValue);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const first = converted[0];
    const diff = Number((converted[converted.length - 1].plotValue - first.plotValue).toFixed(2));

    return {
      displayUnit,
      points: converted,
      minVal,
      maxVal,
      latest: converted[converted.length - 1],
      diff,
    };
  }, [entries]);

  if (!points) return null;

  const width = 480;
  const height = 160;
  const padX = 28;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const range = points.maxVal - points.minVal;
  const safeMin = range === 0 ? points.minVal - 1 : points.minVal - range * 0.15;
  const safeMax = range === 0 ? points.maxVal + 1 : points.maxVal + range * 0.15;
  const safeSpan = Math.max(0.01, safeMax - safeMin);

  const coords = points.points.map((pt, idx) => {
    const x =
      points.points.length === 1
        ? padX + innerW / 2
        : padX + (idx / (points.points.length - 1)) * innerW;
    const y =
      padY + innerH - ((pt.plotValue - safeMin) / safeSpan) * innerH;
    return { ...pt, x, y };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`
      : '';

  return (
    <section
      aria-label="Weight over time"
      className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-secondary-container/50 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              monitor_weight
            </span>
          </div>
          <div>
            <h3 className="font-label-lg text-label-lg font-bold text-on-surface">
              Weight over time
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              Latest: {points.latest.rawValue} {points.latest.rawUnit} on{' '}
              {formatEntryDate(points.latest.date)}
            </p>
          </div>
        </div>

        {points.points.length >= 2 && (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              points.diff > 0
                ? 'bg-secondary-container/50 text-primary'
                : points.diff < 0
                ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {points.diff > 0 ? '+' : ''}
            {points.diff} {points.displayUnit} overall
          </span>
        )}
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 sm:h-40 overflow-visible"
          role="img"
          aria-label={`Weight chart showing ${points.points.length} records`}
        >
          {/* Horizontal guides */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padY + innerH * ratio;
            const labelVal = safeMax - ratio * safeSpan;
            return (
              <g key={ratio}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-outline-variant/35"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
                <text
                  x={padX - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-on-surface-variant text-[10px]"
                >
                  {labelVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {areaPath && (
            <path d={areaPath} className="fill-primary/10" />
          )}

          {coords.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              className="text-primary"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {coords.map((c) => (
            <g key={c.id}>
              <circle
                cx={c.x}
                cy={c.y}
                r="4.5"
                className="fill-primary stroke-surface"
                strokeWidth="2"
              >
                <title>
                  {formatEntryDate(c.date)}: {c.rawValue} {c.rawUnit}
                </title>
              </circle>
            </g>
          ))}
        </svg>

        <div className="flex items-center justify-between text-[11px] text-on-surface-variant px-6 mt-1">
          <span>{formatEntryDate(coords[0].date)}</span>
          {coords.length > 1 && (
            <span>{formatEntryDate(coords[coords.length - 1].date)}</span>
          )}
        </div>
      </div>
    </section>
  );
};
