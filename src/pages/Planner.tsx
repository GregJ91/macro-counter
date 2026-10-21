import { useMemo, useState, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, formatShort, fromISO, todayISO } from '../lib/dates';
import { activityFactor, KCAL_PER_KG, KCAL_PER_STEP_PER_KG, LIFESTYLES, daysToGoal, minimumSafeIntake, projectWeight } from '../lib/nutrition';
import { useStore } from '../lib/store';
import { computePlan } from '../lib/targets';
import { formatWeight, formatWeightDelta, kgToUnit } from '../lib/units';

export function Planner() {
  const { data, setProfile } = useStore();
  const today = todayISO();
  const plan = useMemo(() => computePlan(data, today), [data, today]);
  const profile = data.profile!;
  const baseKg = plan?.currentKg ?? 70;

  const [startKg, setStartKg] = useState(Math.round(baseKg * 10) / 10);
  const [intake, setIntake] = useState(Math.round((plan?.targets.kcal ?? 2000) / 10) * 10);
  const [burn, setBurn] = useState(0);
  const baselineSteps = LIFESTYLES[profile.lifestyle].baselineSteps;
  const [steps, setSteps] = useState(() => {
    const recent = Object.entries(data.steps).filter(([d]) => d >= addDays(today, -14) && d < today);
    return recent.length ? Math.round(recent.reduce((s, [, n]) => s + n, 0) / recent.length / 500) * 500 : baselineSteps;
  });
  const [weeks, setWeeks] = useState(16);

  if (!plan) return null;
  const unit = profile.weightUnit;
  const af = activityFactor(profile);
  // Maintenance at the chosen starting weight (adjusting the estimate if the slider moved away from today's weight).
  const maintenance = plan.expenditure.tdee + 10 * af * (startKg - baseKg);
  // Your lifestyle setting already assumes `baselineSteps`; walking more or less than that shifts the burn.
  const stepBurn = (steps - baselineSteps) * startKg * KCAL_PER_STEP_PER_KG;
  const extraBurn = burn + stepBurn;
  const dailyBalance = intake - (maintenance + extraBurn);
  const weeklyKg = (dailyBalance * 7) / KCAL_PER_KG;
  const points = projectWeight({ startKg, intake, tdee: maintenance, extraBurn, activityFactor: af, days: weeks * 7 });
  const endKg = points[points.length - 1].kg;
  const goalDay = profile.goalKg !== startKg ? daysToGoal(projectWeight({ startKg, intake, tdee: maintenance, extraBurn, activityFactor: af, days: 3 * 365 }), startKg, profile.goalKg) : null;
  const pctPerWeek = (Math.abs(weeklyKg) / startKg) * 100;
  const minIntake = minimumSafeIntake(profile.sex);

  const chartData = points
    .filter((p) => p.day % 7 === 0)
    .map((p) => ({ date: addDays(today, p.day), value: Number(kgToUnit(p.kg, unit === 'st' ? 'lb' : unit).toFixed(1)), kg: p.kg }));
  const chartUnit = unit === 'kg' ? 'kg' : 'lb';
  const goalInChartUnit = kgToUnit(profile.goalKg, chartUnit);

  const slider = (label: string, value: string, input: ReactNode, hint?: string) => (
    <div>
      <div className="slider-head">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      {input}
      {hint && <div className="faint">{hint}</div>}
    </div>
  );

  return (
    <>
      <div className="topbar"><h1>Planner</h1></div>

      <div className="card">
        <h2>What if…</h2>
        {slider(
          'Starting weight',
          formatWeight(startKg, unit),
          <input type="range" min={Math.max(35, Math.floor(baseKg - 40))} max={Math.ceil(baseKg + 40)} step={0.1} value={startKg} onChange={(e) => setStartKg(Number(e.target.value))} />,
          `Your current trend weight is ${formatWeight(baseKg, unit)}`,
        )}
        {slider(
          'Calories eaten per day',
          `${intake} kcal`,
          <input type="range" min={1000} max={4500} step={10} value={intake} onChange={(e) => setIntake(Number(e.target.value))} />,
          `Your current target is ${Math.round(plan.targets.kcal)} kcal`,
        )}
        {slider(
          'Extra calories burnt per day (exercise)',
          `${burn} kcal`,
          <input type="range" min={0} max={1500} step={25} value={burn} onChange={(e) => setBurn(Number(e.target.value))} />,
          'Beyond the workouts already in your profile — e.g. a 5 km run ≈ 300 kcal',
        )}
        {slider(
          'Average steps per day',
          `${steps.toLocaleString('en-GB')}`,
          <input type="range" min={0} max={25000} step={500} value={steps} onChange={(e) => setSteps(Number(e.target.value))} />,
          `Your lifestyle already assumes ~${baselineSteps.toLocaleString('en-GB')} steps · ${stepBurn >= 0 ? '+' : '−'}${Math.abs(Math.round(stepBurn))} kcal/day`,
        )}
        {slider(
          'Look ahead',
          `${weeks} weeks`,
          <input type="range" min={4} max={52} step={1} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />,
        )}
      </div>

      <div className="card">
        <h2>Result</h2>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="big-stat" style={{ color: weeklyKg < 0 ? 'var(--good)' : weeklyKg > 0 ? 'var(--warn)' : undefined }}>
              {formatWeightDelta(weeklyKg, unit)}
            </div>
            <div className="muted">per week</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>{formatWeight(endKg, unit)}</div>
            <div className="muted">in {weeks} weeks ({formatWeightDelta(endKg - startKg, unit)})</div>
          </div>
        </div>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat"><b>{Math.round(maintenance)}</b><span>Maintenance kcal/day</span></div>
          <div className="stat"><b>{dailyBalance > 0 ? '+' : ''}{Math.round(dailyBalance)}</b><span>Daily {dailyBalance < 0 ? 'deficit' : 'surplus'} (kcal)</span></div>
          <div className="stat"><b>{formatWeightDelta((dailyBalance * 30) / KCAL_PER_KG, unit)}</b><span>Per month (approx.)</span></div>
          <div className="stat">
            <b>{goalDay !== null ? formatShort(addDays(today, goalDay)) : '—'}</b>
            <span>{goalDay !== null ? `Reach goal ${formatWeight(profile.goalKg, unit)} (${Math.round(goalDay / 7)} wks)` : `Goal ${formatWeight(profile.goalKg, unit)} not reached`}</span>
          </div>
        </div>

        <div className="legend" style={{ marginTop: 14 }}>
          <span><i style={{ background: 'var(--accent)' }} />Projected weight ({chartUnit})</span>
          <span><i style={{ background: 'var(--text-3)' }} />Goal</span>
        </div>
        <div className="chart">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => formatShort(d)} tick={{ fill: 'var(--text-3)', fontSize: 11 }} stroke="var(--border)" minTickGap={24} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-3)', fontSize: 11 }} stroke="var(--border)" width={44} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="tooltip">
                      <div>{fromISO(payload[0].payload.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <b>{formatWeight(payload[0].payload.kg, unit)}</b>
                    </div>
                  ) : null
                }
              />
              <ReferenceLine y={goalInChartUnit} stroke="var(--text-3)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {intake < minIntake && <p className="note warn">⚠ {intake} kcal is below the commonly advised minimum of {minIntake} kcal/day without medical supervision.</p>}
        {weeklyKg < 0 && pctPerWeek > 1 && <p className="note warn">⚠ Losing more than ~1% of body weight per week ({pctPerWeek.toFixed(1)}%) makes muscle loss and rebound more likely.</p>}
        {weeklyKg < 0 && pctPerWeek <= 1 && pctPerWeek >= 0.25 && <p className="note good">✓ {pctPerWeek.toFixed(1)}% of body weight per week — a sustainable pace.</p>}
        <p className="faint">
          Assumes ~7,700 kcal per kg of body weight and that your maintenance falls slightly as you lose weight. Real results vary with water, glycogen and
          logging accuracy — your trend weight on the Progress tab will tell the truth.
        </p>

        <button
          className="btn primary block"
          onClick={() => {
            // Store the plan as a rate, so the daily target keeps adapting as expenditure estimates improve.
            setProfile({ ...profile, rateKgPerWeek: Math.round(((intake - plan.expenditure.tdee) * 7 * 1000) / KCAL_PER_KG) / 1000, calorieOverride: null });
            setStartKg(Math.round(baseKg * 10) / 10);
          }}
        >
          Use {intake} kcal/day as my plan
        </button>
        {(burn > 0 || Math.round(stepBurn) !== 0) && <p className="faint">Your food target ignores the exercise and step sliders — log workouts and steps in the diary instead.</p>}
      </div>
    </>
  );
}
