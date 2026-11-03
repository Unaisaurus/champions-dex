import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useId, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { STAT_IDS, type Form, type StatId } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import {
  EMPTY_STAT_POINTS,
  alignmentPercent,
  calculateStats,
  maxStatPointsFor,
  setStatPoint,
  totalStatPoints,
} from '@/domain/stats';
import type { TeamMember } from '@/domain/team';
import type { ValidationIssue } from '@/domain/validation';
import { useGameText } from '@/i18n/useGameText';
import { Button } from '@/ui/components/Button';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { useFormLabels } from '@/ui/useFormLabels';
import { IssueList } from './IssueList';
import type { MemberChange } from './types';
import { useAlignmentOptions } from './useFieldOptions';
import styles from './TeamEditor.module.css';

/**
 * Stat Alignment and Stat Points, with the resulting battle stats (level 50)
 * worked out as you go. With a Mega Stone, the Mega's stats can be shown too.
 */
export function StatsField({
  member,
  gameplay,
  mega,
  issues,
  onChange,
}: {
  member: TeamMember;
  gameplay: Form;
  mega: Form | null;
  issues: readonly ValidationIssue[];
  onChange: MemberChange;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const titleId = useId();
  const alignmentId = useId();
  const [showMega, setShowMega] = useState(false);
  const { rules } = data;

  const statsOf = showMega && mega ? mega : gameplay;
  const alignment = member.alignmentId !== null ? data.alignmentsById.get(member.alignmentId) : undefined;
  const stats = calculateStats(statsOf.baseStats, member.statPoints, alignment, rules);
  const used = totalStatPoints(member.statPoints);
  const left = rules.statPoints.total - used;
  const statName = (stat: StatId) => t(`stats.${stat}`);

  const alignmentOptions = useAlignmentOptions();
  const unknownAlignment = member.alignmentId !== null && !alignment;

  const setPoints = (stat: StatId, value: number) =>
    onChange((current) => ({
      ...current,
      statPoints: setStatPoint(current.statPoints, stat, Number.isFinite(value) ? value : 0, rules),
    }));

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.panelTitle}>
        {t('teamEditor.member.statsTitle')}
      </h3>

      <div className={styles.selectField}>
        <label htmlFor={alignmentId}>{t('terms.statAlignment')}</label>
        <select
          id={alignmentId}
          value={member.alignmentId ?? ''}
          aria-invalid={unknownAlignment || undefined}
          onChange={(event) => {
            const value = event.target.value || null;
            onChange((current) => ({ ...current, alignmentId: value }));
          }}
        >
          {member.alignmentId === null && <option value="">{t('teamEditor.member.alignmentChoose')}</option>}
          {unknownAlignment && <option value={member.alignmentId ?? ''}>{member.alignmentId}</option>}
          {alignmentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {mega && (
        <SegmentedControl
          label={t('teamEditor.member.statsOf')}
          options={[
            { value: 'base', label: text.name('pokemon-names', gameplay.speciesId) },
            { value: 'mega', label: labels.get(mega.id) ?? text.name('pokemon-names', mega.speciesId) },
          ]}
          value={showMega ? 'mega' : 'base'}
          onChange={(value) => setShowMega(value === 'mega')}
        />
      )}

      <div className={styles.spSummary}>
        <p>
          {t('teamEditor.member.spUsed', { used, total: rules.statPoints.total })}
          {' · '}
          <span className={left < 0 ? styles.over : undefined}>
            {t('teamEditor.member.spLeft', { count: left })}
          </span>
        </p>
        <Button
          variant="quiet"
          disabled={used === 0}
          onClick={() => onChange((current) => ({ ...current, statPoints: { ...EMPTY_STAT_POINTS } }))}
        >
          <RotateCcw size={16} aria-hidden="true" />
          {t('teamEditor.member.spReset')}
        </Button>
      </div>

      <div className={styles.statTable}>
        <div className={styles.statHead} aria-hidden="true">
          <span>{t('teamEditor.member.stat')}</span>
          <span>{t('teamEditor.member.base')}</span>
          <span className={styles.statHeadPoints}>{t('teamEditor.member.points')}</span>
          <span className={styles.statHeadValue}>{t('teamEditor.member.value')}</span>
        </div>
        {STAT_IDS.map((stat) => {
          const percent = alignmentPercent(stat, alignment, rules);
          const points = member.statPoints[stat];
          // How far this stat can still go, given the points spent elsewhere.
          const max = maxStatPointsFor(stat, member.statPoints, rules);
          const pointsLabel = t('teamEditor.member.pointsFor', { stat: statName(stat) });
          const effect =
            percent > 100
              ? t('teamEditor.member.raised')
              : percent < 100
                ? t('teamEditor.member.lowered')
                : null;
          return (
            <div key={stat} className={styles.statRow} role="group" aria-label={statName(stat)}>
              <span className={styles.statName}>
                {statName(stat)}
                {percent > 100 && <ChevronUp size={16} className={styles.raised} aria-hidden="true" />}
                {percent < 100 && <ChevronDown size={16} className={styles.lowered} aria-hidden="true" />}
                {effect && <span className="visually-hidden">{effect}</span>}
              </span>
              <span className={styles.statBase} data-label={t('teamEditor.member.base')}>
                {statsOf.baseStats[stat]}
              </span>
              <input
                type="range"
                className={styles.statSlider}
                style={
                  {
                    '--value': `${(points / rules.statPoints.perStat) * 100}%`,
                    '--limit': `${(max / rules.statPoints.perStat) * 100}%`,
                  } as CSSProperties
                }
                min={0}
                max={rules.statPoints.perStat}
                step={1}
                value={points}
                aria-label={pointsLabel}
                onChange={(event) => setPoints(stat, event.target.valueAsNumber)}
              />
              <input
                type="number"
                className={styles.statInput}
                inputMode="numeric"
                min={0}
                max={rules.statPoints.perStat}
                step={1}
                value={points}
                aria-label={pointsLabel}
                onChange={(event) => setPoints(stat, event.target.valueAsNumber)}
              />
              <span
                className={`${styles.statValue} ${percent > 100 ? styles.raised : ''} ${percent < 100 ? styles.lowered : ''}`}
              >
                {stats[stat]}
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.panelHint}>{t('teamEditor.member.statsHint', { level: rules.level })}</p>
      <IssueList issues={issues} />
    </section>
  );
}
