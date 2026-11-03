import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SIDES,
  TERRAINS,
  WEATHERS,
  type BattleFormat,
  type CalcField,
  type SideConditions,
  type SideId,
  type Terrain,
  type Weather,
} from '@/domain/calculator';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { ToggleChip } from '@/ui/components/ToggleChip';
import styles from './Calculator.module.css';

type FlagCondition = Exclude<keyof SideConditions, 'spikes'>;

/** Conditions that only exist in double battles (they need a partner). */
const DOUBLES_ONLY: ReadonlySet<FlagCondition> = new Set(['helpingHand', 'friendGuard']);
/** Entry hazards: they matter when a Pokémon switches in, so mostly in single battles. */
const SINGLES_ONLY: ReadonlySet<FlagCondition> = new Set(['stealthRock']);
const SIDE_FLAGS: readonly FlagCondition[] = [
  'reflect',
  'lightScreen',
  'auroraVeil',
  'helpingHand',
  'friendGuard',
  'tailwind',
  'stealthRock',
];

/** The battlefield: battle type, weather, terrain, rooms and what's on each side. */
export function FieldPanel({ field, onChange }: { field: CalcField; onChange(next: CalcField): void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const set = <K extends keyof CalcField>(key: K, value: CalcField[K]) =>
    onChange({ ...field, [key]: value });

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.panelTitle}>
        {t('calc.field.title')}
      </h2>
      <div className={styles.fieldRows}>
        <SegmentedControl<BattleFormat>
          label={t('calc.field.format')}
          options={[
            { value: 'doubles', label: t('calc.field.doubles') },
            { value: 'singles', label: t('calc.field.singles') },
          ]}
          value={field.format}
          onChange={(format) => set('format', format)}
        />
        <SegmentedControl<Weather | 'none'>
          label={t('calc.field.weather')}
          options={[
            { value: 'none', label: t('calc.field.none') },
            ...WEATHERS.map((weather) => ({ value: weather, label: t(`calc.field.weathers.${weather}`) })),
          ]}
          value={field.weather ?? 'none'}
          onChange={(weather) => set('weather', weather === 'none' ? null : weather)}
        />
        <SegmentedControl<Terrain | 'none'>
          label={t('calc.field.terrain')}
          options={[
            { value: 'none', label: t('calc.field.none') },
            ...TERRAINS.map((terrain) => ({ value: terrain, label: t(`calc.field.terrains.${terrain}`) })),
          ]}
          value={field.terrain ?? 'none'}
          onChange={(terrain) => set('terrain', terrain === 'none' ? null : terrain)}
        />
        <div className={styles.chipGroup} role="group" aria-label={t('calc.field.whole')}>
          <span className={styles.chipLabel}>{t('calc.field.whole')}</span>
          {(['trickRoom', 'gravity', 'magicRoom', 'wonderRoom'] as const).map((key) => (
            <ToggleChip key={key} pressed={field[key]} onToggle={() => set(key, !field[key])}>
              {t(`calc.field.${key}`)}
            </ToggleChip>
          ))}
        </div>
        {SIDES.map((side) => (
          <SideRow
            key={side}
            side={side}
            format={field.format}
            conditions={field[side]}
            onChange={(conditions) => set(side, conditions)}
          />
        ))}
      </div>
    </section>
  );
}

function SideRow({
  side,
  format,
  conditions,
  onChange,
}: {
  side: SideId;
  format: BattleFormat;
  conditions: SideConditions;
  onChange(next: SideConditions): void;
}) {
  const { t } = useTranslation();
  const spikesId = useId();
  const flags = SIDE_FLAGS.filter(
    (flag) => (format === 'doubles' ? !SINGLES_ONLY.has(flag) : !DOUBLES_ONLY.has(flag)) || conditions[flag],
  );
  return (
    <div className={styles.chipGroup} role="group" aria-label={t(`calc.field.sides.${side}`)}>
      <span className={styles.chipLabel}>{t(`calc.field.sides.${side}`)}</span>
      {flags.map((flag) => (
        <ToggleChip
          key={flag}
          pressed={conditions[flag]}
          onToggle={() => onChange({ ...conditions, [flag]: !conditions[flag] })}
        >
          {t(`calc.field.${flag}`)}
        </ToggleChip>
      ))}
      {(format === 'singles' || conditions.spikes > 0) && (
        <span className={styles.inlineField}>
          <label htmlFor={spikesId}>{t('calc.field.spikes')}</label>
          <select
            id={spikesId}
            value={conditions.spikes}
            onChange={(event) => onChange({ ...conditions, spikes: Number(event.target.value) })}
          >
            {[0, 1, 2, 3].map((layers) => (
              <option key={layers} value={layers}>
                {layers}
              </option>
            ))}
          </select>
        </span>
      )}
    </div>
  );
}
