import { ArrowRight, Copy, Gauge } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import {
  activeForms,
  otherSide,
  type CalcPokemon,
  type SelectedMove,
  type SideId,
} from '@/domain/calculator';
import type { DamageOutcome, MoveOutcome } from '@/domain/damage/calculate';
import { moveOrder } from '@/domain/speed';
import { useGameText } from '@/i18n/useGameText';
import { Button } from '@/ui/components/Button';
import { TypeBadge } from '@/ui/components/TypeBadge';
import { showToast } from '@/ui/toasts';
import { useFormLabels } from '@/ui/useFormLabels';
import { formDisplayName } from './names';
import { formatNumber, formatPercent, koLevel, koText } from './resultText';
import type { SideResults } from './useDamage';
import styles from './Calculator.module.css';

interface ResultsProps {
  pokemon: Record<SideId, CalcPokemon | null>;
  results: readonly SideResults[];
  speeds: { ours: number; theirs: number } | null;
  trickRoom: boolean;
  selected: SelectedMove | null;
  onSelect(selected: SelectedMove): void;
}

/** The move whose details are shown: the one picked, or else the first that does damage. */
function shownMove(results: readonly SideResults[], selected: SelectedMove | null): SelectedMove | null {
  const outcomeAt = (move: SelectedMove) =>
    results.find((entry) => entry.side === move.side)?.outcomes[move.slot] ?? null;
  if (selected && outcomeAt(selected)?.kind === 'damage') return selected;
  for (const { side, outcomes } of results) {
    const slot = outcomes.findIndex((outcome) => outcome?.kind === 'damage');
    if (slot >= 0) return { side, slot };
  }
  return null;
}

/** Each side's moves against the other, who moves first, and the details of one move. */
export function Results({ pokemon, results, speeds, trickRoom, selected, onSelect }: ResultsProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const offscreen = useOffscreen(sectionRef, pokemon.ours !== null && pokemon.theirs !== null);
  const names = useNames(pokemon);
  const shown = shownMove(results, selected);
  const shownOutcome = shown
    ? (results.find((entry) => entry.side === shown.side)?.outcomes[shown.slot] ?? null)
    : null;

  if (!pokemon.ours || !pokemon.theirs) {
    return (
      <section className={`${styles.panel} ${styles.results}`} aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.panelTitle}>
          {t('calc.results.title')}
        </h2>
        <p className={styles.muted}>{t('calc.results.choose')}</p>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className={`${styles.panel} ${styles.results}`} aria-labelledby={titleId}>
      <div className={styles.resultsHead}>
        <h2 id={titleId} className={styles.panelTitle}>
          {t('calc.results.title')}
        </h2>
        {speeds && <SpeedLine speeds={speeds} trickRoom={trickRoom} names={names} />}
      </div>
      <div className={styles.directions}>
        {results.map(({ side, outcomes }) => (
          <div key={side} className={styles.direction}>
            <h3 className={styles.directionTitle}>
              <span>{names[side]}</span>
              <ArrowRight size={16} aria-label={t('calc.results.against')} />
              <span>{names[otherSide(side)]}</span>
            </h3>
            {outcomes.some((outcome) => outcome !== null) ? (
              <ul className={styles.resultList}>
                {outcomes.map((outcome, slot) =>
                  outcome ? (
                    <li key={slot}>
                      <ResultRow
                        outcome={outcome}
                        pressed={shown?.side === side && shown.slot === slot}
                        onSelect={() => onSelect({ side, slot })}
                      />
                    </li>
                  ) : null,
                )}
              </ul>
            ) : (
              <p className={styles.muted}>{t('calc.results.noMoves', { name: names[side] })}</p>
            )}
          </div>
        ))}
      </div>
      {shown && shownOutcome?.kind === 'damage' && (
        <Details
          outcome={shownOutcome}
          attacker={names[shown.side]}
          defender={names[otherSide(shown.side)]}
        />
      )}
      {offscreen && shownOutcome?.kind === 'damage' && (
        <StickyResult
          outcome={shownOutcome}
          onClick={() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      )}
    </section>
  );
}

/** True while the element is scrolled out of view (once `ready`: it's on the page). */
function useOffscreen(ref: RefObject<HTMLElement | null>, ready: boolean): boolean {
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!ready || !element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setOffscreen(entry ? !entry.isIntersecting : false),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      setOffscreen(false);
    };
  }, [ref, ready]);
  return offscreen;
}

/** The chosen move's result, kept in view at the bottom of the screen while you change things further down. */
function StickyResult({ outcome, onClick }: { outcome: DamageOutcome; onClick(): void }) {
  const ko = useKoText(outcome);
  return (
    <button type="button" className={styles.stickyResult} onClick={onClick}>
      <MoveName moveId={outcome.moveId} />
      <Range outcome={outcome} />
      <span className={styles.stickyKo}>{ko}</span>
    </button>
  );
}

function useNames(pokemon: Record<SideId, CalcPokemon | null>): Record<SideId, string> {
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const name = (entry: CalcPokemon | null) => {
    const forms = entry ? activeForms(entry, data) : null;
    return forms ? formDisplayName(forms.active, text, labels) : '';
  };
  return { ours: name(pokemon.ours), theirs: name(pokemon.theirs) };
}

function useKoText(outcome: DamageOutcome): string {
  const { t } = useTranslation();
  const text = useGameText();
  return koText(outcome.ko, { t, text });
}

function MoveName({ moveId }: { moveId: string }) {
  const data = useGameData();
  const text = useGameText();
  const move = data.movesById.get(moveId);
  return (
    <span className={styles.moveName}>
      <span>{text.name('move-names', moveId)}</span>
      {move && <TypeBadge type={move.type} size="sm" />}
    </span>
  );
}

function Range({ outcome }: { outcome: DamageOutcome }) {
  const text = useGameText();
  const { minPercent, maxPercent } = outcome;
  return (
    <span className={styles.range}>
      {formatPercent(minPercent, text.language)} – {formatPercent(maxPercent, text.language)}
    </span>
  );
}

function ResultRow({
  outcome,
  pressed,
  onSelect,
}: {
  outcome: MoveOutcome;
  pressed: boolean;
  onSelect(): void;
}) {
  const { t } = useTranslation();
  if (outcome.kind !== 'damage') {
    return (
      <div className={`${styles.resultRow} ${styles.resultQuiet}`}>
        <MoveName moveId={outcome.moveId} />
        <span className={styles.resultNote}>
          {t(outcome.kind === 'status' ? 'calc.results.statusMove' : 'calc.results.noDamage')}
        </span>
      </div>
    );
  }
  return <DamageRow outcome={outcome} pressed={pressed} onSelect={onSelect} />;
}

function DamageRow({
  outcome,
  pressed,
  onSelect,
}: {
  outcome: DamageOutcome;
  pressed: boolean;
  onSelect(): void;
}) {
  const ko = useKoText(outcome);
  const level = koLevel(outcome.ko);
  const bar = {
    '--min': `${Math.min(100, outcome.minPercent)}%`,
    '--max': `${Math.min(100, outcome.maxPercent)}%`,
  } as CSSProperties;
  return (
    <button
      type="button"
      className={`${styles.resultRow} ${styles[`ko-${level}`] ?? ''}`}
      aria-pressed={pressed}
      onClick={onSelect}
    >
      <MoveName moveId={outcome.moveId} />
      <Range outcome={outcome} />
      <span className={styles.damageBar} style={bar} aria-hidden="true">
        <span className={styles.damageMax} />
        <span className={styles.damageMin} />
      </span>
      <span className={styles.koText}>{ko}</span>
    </button>
  );
}

/** Who moves first, with both Speeds. */
function SpeedLine({
  speeds,
  trickRoom,
  names,
}: {
  speeds: { ours: number; theirs: number };
  trickRoom: boolean;
  names: Record<SideId, string>;
}) {
  const { t } = useTranslation();
  const order = moveOrder(speeds.ours, speeds.theirs, trickRoom);
  const first = order === 'first' ? names.ours : names.theirs;
  return (
    <p className={styles.speedLine}>
      <Gauge size={16} aria-hidden="true" />
      <span>
        {order === 'tie' ? t('calc.results.speedTie') : t('calc.results.movesFirst', { name: first })}
        {trickRoom && ` ${t('calc.results.inTrickRoom')}`}
      </span>
      <span className={styles.muted}>
        {order === 'tie'
          ? t('calc.results.speedValue', { speed: speeds.ours })
          : t('calc.results.speeds', {
              first: order === 'first' ? speeds.ours : speeds.theirs,
              second: order === 'first' ? speeds.theirs : speeds.ours,
            })}
      </span>
    </p>
  );
}

/** Everything about one move: amounts, every roll, what the KO counts, and Showdown's description. */
function Details({
  outcome,
  attacker,
  defender,
}: {
  outcome: DamageOutcome;
  attacker: string;
  defender: string;
}) {
  const { t } = useTranslation();
  const text = useGameText();
  const titleId = useId();
  const ko = useKoText(outcome);
  const move = text.name('move-names', outcome.moveId);
  const number = (value: number) => formatNumber(value, text.language);
  const notes: string[] = [];
  if (outcome.spread) notes.push(t('calc.results.spread'));
  if (outcome.recovery) {
    notes.push(
      t(outcome.recovery[1] > 0 ? 'calc.results.recovery' : 'calc.results.hpLoss', {
        min: number(Math.abs(outcome.recovery[0])),
        max: number(Math.abs(outcome.recovery[1])),
      }),
    );
  }
  if (outcome.recoil) {
    notes.push(
      t('calc.results.recoil', {
        min: formatPercent(outcome.recoil[0], text.language),
        max: formatPercent(outcome.recoil[1], text.language),
      }),
    );
  }
  if (outcome.crashDamage) notes.push(t('calc.results.crash'));
  if (outcome.target.hp < outcome.target.maxHp) {
    notes.push(
      t('calc.results.currentHp', { hp: number(outcome.target.hp), max: number(outcome.target.maxHp) }),
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(outcome.description);
      showToast(t('calc.results.copied'));
    } catch {
      showToast(t('calc.results.copyFailed'));
    }
  };

  return (
    <section className={styles.details} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.detailsTitle}>
        {t('calc.results.detailsTitle', { move, attacker, defender })}
      </h3>
      <p className={styles.detailsAmount}>
        <strong>
          {t('calc.results.hpRange', {
            min: number(outcome.min),
            max: number(outcome.max),
            total: number(outcome.target.maxHp),
          })}
        </strong>{' '}
        <span className={styles.muted}>
          ({formatPercent(outcome.minPercent, text.language)} –{' '}
          {formatPercent(outcome.maxPercent, text.language)})
        </span>
      </p>
      <p className={styles.detailsKo}>{ko}</p>
      {notes.length > 0 && (
        <ul className={styles.notes}>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {outcome.incomplete && <p className={styles.caveat}>{t('calc.results.incomplete')}</p>}
      <div className={styles.rolls}>
        <h4 className={styles.rollsTitle}>{t('calc.results.rolls')}</h4>
        {outcome.hits.map((rolls, index) => (
          <p key={index} className={styles.rollLine}>
            {outcome.hits.length > 1 && (
              <span className={styles.hitLabel}>{t('calc.results.hit', { n: index + 1 })}</span>
            )}
            <span className={styles.rollNumbers}>{rolls.map(number).join(', ')}</span>
          </p>
        ))}
      </div>
      <div className={styles.showdown}>
        <p className={styles.showdownLabel}>{t('calc.results.showdown')}</p>
        <p className={styles.showdownText} lang="en">
          {outcome.description}
        </p>
        {typeof navigator !== 'undefined' && navigator.clipboard && (
          <Button variant="quiet" onClick={() => void copy()}>
            <Copy size={16} aria-hidden="true" />
            {t('calc.results.copy')}
          </Button>
        )}
      </div>
    </section>
  );
}
