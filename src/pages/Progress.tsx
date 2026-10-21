import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, formatShort, fromISO, todayISO } from '../lib/dates';
import { dailyIntake, weightTrend } from '../lib/nutrition';
import { useStore } from '../lib/store';
import { computePlan } from '../lib/targets';
import { formatWeight, formatWeightDelta, kgToUnit } from '../lib/units';
import { WeightSheet } from './Diary';

const RANGES = [
  ['1M', 30],
  ['3M', 90],
  ['6M', 182],
  ['1Y', 365],
  ['All', 100000],
] as const;

export function Progress() {
  const { data, setWeight, removeWeight } = useStore();
  const today = todayISO();
  const plan = useMemo(() => computePlan(data, today), [data, today]);
  const trend = useMemo(() => weightTrend(data.weights), [data.weights]);
  const [range, setRange] = useState<number>(90);
  const [logOpen, setLogOpen] = useState(false);
  if (!plan || !data.profile) return null;
  const unit = data.profile.weightUnit;
  const chartUnit = unit === 'kg' ? 'kg' : 'lb';

  const from = addDays(today, -range);
  const shown = trend.filter((p) => p.date >= from);
  const chartData = shown.map((p) => ({
    date: p.date,
    trend: Number(kgToUnit(p.trend, chartUnit).toFixed(2)),
    scale: p.scale !== undefined ? Number(kgToUnit(p.scale, chartUnit).toFixed(1)) : undefined,
    trendKg: p.trend,
    scaleKg: p.scale,
  }));

  const latest = trend[trend.length - 1];
  const at = (daysAgo: number) => trend.find((p) => p.date >= addDays(latest.date, -daysAgo)) ?? trend[0];
  const weekChange = latest ? latest.trend - at(7).trend : 0;
  const monthChange = latest ? latest.trend - at(30).trend : 0;

  const intake = dailyIntake(data.diary);
  const calDays = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => ({ date: d, kcal: Math.round(intake.get(d) ?? 0) }));
  const logged7 = calDays.slice(-8, -1).filter((d) => d.kcal > 0);
  const avg7 = logged7.length ? logged7.reduce((s, d) => s + d.kcal, 0) / logged7.length : 0;
  const exp = plan.expenditure;

  return (
    <>
      <div className="topbar">
        <h1>Progress</h1>
        <button className="btn small" onClick={() => setLogOpen(true)}>+ Weight</button>
      </div>

      <div className="card">
        <h2>Trend weight <small>smoothed daily weigh-ins</small></h2>
        {trend.length === 0 ? (
          <p className="muted">Log your weight to see your trend. Weigh daily, first thing in the morning, for the best estimate.</p>
        ) : (
          <>
            <div className="row between">
              <div>
                <div className="big-stat">{formatWeight(latest.trend, unit)}</div>
                <div className="muted">Goal {formatWeight(data.profile.goalKg, unit)}</div>
              </div>
              <div style={{ textAlign: 'right' }} className="num">
                <div>{formatWeightDelta(weekChange, unit)} <span className="faint">7 days</span></div>
                <div>{formatWeightDelta(monthChange, unit)} <span className="faint">30 days</span></div>
              </div>
            </div>
            <div className="segmented" style={{ marginTop: 12 }}>
              {RANGES.map(([label, days]) => (
                <button key={label} aria-pressed={range === days} onClick={() => setRange(days)}>{label}</button>
              ))}
            </div>
            <div className="legend" style={{ marginTop: 10 }}>
              <span><i style={{ background: 'var(--accent)' }} />Trend ({chartUnit})</span>
              <span><i className="dot" style={{ background: 'var(--text-3)' }} />Scale weight</span>
            </div>
            <div className="chart">
              <ResponsiveContainer>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => formatShort(d)} tick={{ fill: 'var(--text-3)', fontSize: 11 }} stroke="var(--border)" minTickGap={24} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-3)', fontSize: 11 }} stroke="var(--border)" width={44} />
                  <Tooltip
                    content={({ active, payload }) => {
                      const p = active && payload?.[0]?.payload;
                      if (!p) return null;
                      return (
                        <div className="tooltip">
                          <div>{fromISO(p.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                          <div>Trend <b>{formatWeight(p.trendKg, unit)}</b></div>
                          {p.scaleKg !== undefined && <div>Scale {formatWeight(p.scaleKg, unit)}</div>}
                        </div>
                      );
                    }}
                  />
                  <Scatter dataKey="scale" fill="var(--text-3)" isAnimationActive={false} shape={(props: { cx?: number; cy?: number }) => (props.cy == null ? <g /> : <circle cx={props.cx} cy={props.cy} r={3} fill="var(--text-3)" opacity={0.7} />)} />
                  <Line type="monotone" dataKey="trend" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Energy expenditure <small>{exp.adaptive === null ? 'formula estimate' : `${Math.round(exp.confidence * 100)}% data-driven`}</small></h2>
        <div className="big-stat">{Math.round(exp.tdee)} <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}>kcal/day</span></div>
        <div className="stat-grid" style={{ marginTop: 10 }}>
          <div className="stat"><b>{Math.round(exp.formula)}</b><span>Formula (Mifflin–St Jeor × activity)</span></div>
          <div className="stat"><b>{exp.adaptive === null ? '—' : Math.round(exp.adaptive)}</b><span>From your intake & weight trend</span></div>
        </div>
        <p className="faint" style={{ marginBottom: 0 }}>
          {exp.adaptive === null
            ? `Log food on at least 7 days and weigh in on 10+ days over the last 4 weeks and the app will start learning your real expenditure (${exp.loggedDays} days logged so far).`
            : `Based on ${exp.loggedDays} fully logged days in the last 4 weeks. Your calorie target updates automatically as this improves.`}
        </p>
      </div>

      <div className="card">
        <h2>Calories, last 14 days <small>avg {Math.round(avg7)} kcal (7 days)</small></h2>
        <div className="legend">
          <span><i style={{ background: 'var(--accent)', height: 8 }} />Eaten (kcal)</span>
          <span><i style={{ background: 'var(--text-3)' }} />Target</span>
        </div>
        <div className="chart" style={{ height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={calDays} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => fromISO(d).toLocaleDateString('en-GB', { weekday: 'narrow' })} tick={{ fill: 'var(--text-3)', fontSize: 11 }} stroke="var(--border)" />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} stroke="var(--border)" width={44} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => (active && payload?.[0] ? <div className="tooltip">{formatShort(payload[0].payload.date)}: <b>{payload[0].payload.kcal} kcal</b></div> : null)} />
              <ReferenceLine y={plan.targets.kcal} stroke="var(--text-3)" strokeDasharray="4 4" />
              <Bar dataKey="kcal" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.weights.length > 0 && (
        <div className="card">
          <h2>Weigh-ins</h2>
          <table className="list">
            <tbody>
              {[...data.weights].reverse().slice(0, 30).map((w) => (
                <tr key={w.date}>
                  <td>{fromISO(w.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="num">
                    {formatWeight(w.kg, unit)}
                    <button className="icon-btn" style={{ fontSize: 14 }} aria-label="Delete weigh-in" onClick={() => removeWeight(w.date)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logOpen && (
        <WeightSheet
          unit={unit}
          initialKg={latest?.trend ?? plan.currentKg}
          onClose={() => setLogOpen(false)}
          onSave={(kg) => {
            setWeight({ date: today, kg });
            setLogOpen(false);
          }}
        />
      )}
    </>
  );
}
