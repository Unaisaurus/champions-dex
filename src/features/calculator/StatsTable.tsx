import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { STAT_IDS, type StatId } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import {
  MAX_STAGE,
  NO_STAGES,
  STAGE_STATS,
  calcStats,
  hasStages,
  stagedStat,
  type ActiveForms,
  type CalcPokemon,
  type StageStat,
} from '@/domain/calculator';
import { EMPTY_STAT_POINTS, alignmentPercent, setStatPoint, totalStatPoints } from '@/domain/stats';
import { Button } from '@/ui/components/Button';
import styles from './Calculator.module.css';

const STAGES = Array.from({ length: MAX_STAGE * 2 + 1 }, (_, index) => MAX_STAGE - index);
const isStageStat = (stat: StatId): stat is StageStat => (STAGE_STATS as readonly StatId[]).includes(stat);
const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');

/** Stat Points and stat stages, with the stats they give. */
export function StatsTable({
  pokemon,
  forms,
  onChange,
}: {
  pokemon: CalcPokemon;
  forms: ActiveForms;
  onChange(next: CalcPokemon): void;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const titleId = useId();
  const { rules } = data;
  const { statPoints, alignmentId } = pokemon.set;
  const alignment = alignmentId !== null ? data.alignmentsById.get(alignmentId) : undefined;
  const stats = calcStats(pokemon, forms, data);
  const used = totalStatPoints(statPoints);
  const left = rules.statPoints.total - used;

  const setPoints = (stat: StatId, value: number) =>
    onChange({
      ...pokemon,
      set: {
        ...pokemon.set,
        statPoints: setStatPoint(statPoints, stat, Number.isFinite(value) ? value : 0, rules),
      },
    });
  const setStage = (stat: StageStat, value: number) =>
    onChange({ ...pokemon, stages: { ...pokemon.stages, [stat]: value } });

  return (
    <fieldset className={styles.stats} aria-labelledby={titleId}>
      <legend id={titleId} className={styles.subTitle}>
        {t('calc.pokemon.stats')}
      </legend>
      <div className={styles.statsSummary}>
        <p>
          {t('calc.pokemon.spUsed', { used, total: rules.statPoints.total })}
          {left !== 0 && (
            <>
              {' · '}
              <span className={left < 0 ? styles.over : undefined}>
                {t('teamEditor.member.spLeft', { count: left })}
              </span>
            </>
          )}
        </p>
        <div className={styles.statsResets}>
          <Button
            variant="quiet"
            disabled={used === 0}
            onClick={() =>
              onChange({ ...pokemon, set: { ...pokemon.set, statPoints: { ...EMPTY_STAT_POINTS } } })
            }
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t('calc.pokemon.resetPoints')}
          </Button>
          <Button
            variant="quiet"
            disabled={!hasStages(pokemon.stages)}
            onClick={() => onChange({ ...pokemon, stages: { ...NO_STAGES } })}
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t('calc.pokemon.resetStages')}
          </Button>
        </div>
      </div>
      <div className={styles.statGrid} role="table" aria-labelledby={titleId}>
        <div className={styles.statGridHead} role="row">
          <span role="columnheader">{t('teamEditor.member.stat')}</span>
          <span role="columnheader">{t('teamEditor.member.base')}</span>
          <span role="columnheader">{t('calc.pokemon.points')}</span>
          <span role="columnheader">{t('calc.pokemon.stage')}</span>
          <span role="columnheader">{t('teamEditor.member.value')}</span>
        </div>
        {STAT_IDS.map((stat) => {
          const percent = alignmentPercent(stat, alignment, rules);
          const stage = isStageStat(stat) ? pokemon.stages[stat] : 0;
          const value = stagedStat(stats[stat], stage);
          const statName = t(`stats.${stat}`);
          return (
            <div key={stat} className={styles.statGridRow} role="row">
              <span className={styles.statName} role="rowheader">
                {t(`statsShort.${stat}`)}
                {percent > 100 && (
                  <ChevronUp size={15} className={styles.raised} aria-label={t('teamEditor.member.raised')} />
                )}
                {percent < 100 && (
                  <ChevronDown
                    size={15}
                    className={styles.lowered}
                    aria-label={t('teamEditor.member.lowered')}
                  />
                )}
              </span>
              <span className={styles.statBase} role="cell">
                {forms.active.baseStats[stat]}
              </span>
              <span role="cell">
                <input
                  type="number"
                  className={styles.pointsInput}
                  inputMode="numeric"
                  min={0}
                  max={rules.statPoints.perStat}
                  value={statPoints[stat]}
                  aria-label={t('teamEditor.member.pointsFor', { stat: statName })}
                  onChange={(event) => setPoints(stat, event.target.valueAsNumber)}
                />
              </span>
              <span role="cell">
                {isStageStat(stat) ? (
                  <select
                    className={`${styles.stageSelect} ${stage > 0 ? styles.raised : stage < 0 ? styles.lowered : ''}`}
                    value={stage}
                    aria-label={t('calc.pokemon.stageFor', { stat: statName })}
                    onChange={(event) => setStage(stat, Number(event.target.value))}
                  >
                    {STAGES.map((option) => (
                      <option key={option} value={option}>
                        {signed(option)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={styles.noStage} aria-hidden="true">
                    —
                  </span>
                )}
              </span>
              <span
                className={`${styles.statValue} ${stage > 0 ? styles.raised : stage < 0 ? styles.lowered : ''}`}
                role="cell"
                title={stage !== 0 ? t('calc.pokemon.beforeStage', { value: stats[stat] }) : undefined}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
