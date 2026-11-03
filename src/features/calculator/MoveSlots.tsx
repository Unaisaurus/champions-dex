import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import {
  activeAbility,
  moveOptionsAt,
  setMoveOptions,
  type ActiveForms,
  type CalcPokemon,
} from '@/domain/calculator';
import { hitChoices, type DamageContext } from '@/domain/damage/calculate';
import { moveSlots } from '@/domain/teamEditing';
import { useLearnableMoveOptions, useMoveSlotOptions } from '@/features/team-builder/useFieldOptions';
import { SearchSelect } from '@/ui/components/SearchSelect';
import { ToggleChip } from '@/ui/components/ToggleChip';
import styles from './Calculator.module.css';

/** Its moves, each with a critical-hit switch and, for multi-hit moves, how many hits. */
export function MoveSlots({
  pokemon,
  forms,
  ctx,
  onChange,
}: {
  pokemon: CalcPokemon;
  forms: ActiveForms;
  ctx: DamageContext;
  onChange(next: CalcPokemon): void;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const titleId = useId();
  const slots = useMemo(() => moveSlots(pokemon.set.moves, data.rules), [pokemon.set.moves, data.rules]);
  const learnable = useLearnableMoveOptions(forms.chosen);
  const slotOptions = useMoveSlotOptions(learnable, slots);
  const ability = activeAbility(pokemon, forms);

  const setMove = (index: number, move: Id | null) => {
    const moves = [...slots];
    moves[index] = move;
    // A new move starts with the usual options.
    const cleared = setMoveOptions(pokemon, index, { crit: false, hits: null });
    onChange({ ...cleared, set: { ...pokemon.set, moves } });
  };

  return (
    <fieldset className={styles.moves} aria-labelledby={titleId}>
      <legend id={titleId} className={styles.subTitle}>
        {t('terms.moves')}
      </legend>
      <ol className={styles.moveList}>
        {slots.map((moveId, index) => {
          const options = moveOptionsAt(pokemon, index);
          const hits = moveId !== null ? hitChoices(ctx, moveId, ability) : null;
          const move = moveId !== null ? data.movesById.get(moveId) : undefined;
          const damaging = move !== undefined && move.category !== 'status';
          return (
            <li key={index} className={styles.moveRow}>
              <div className={styles.moveSelect}>
                <SearchSelect
                  label={t('teamEditor.member.moveSlot', { n: index + 1 })}
                  labelHidden
                  options={slotOptions[index] ?? learnable}
                  value={moveId}
                  onChange={(id) => setMove(index, id)}
                  placeholder={t('teamEditor.member.movePlaceholder')}
                  noMatches={t('teamEditor.member.noMoveMatches')}
                  clearLabel={t('teamEditor.member.clearMove')}
                  maxResults={400}
                />
              </div>
              {damaging && (
                <div className={styles.moveOptions}>
                  <ToggleChip
                    pressed={options.crit}
                    onToggle={() => onChange(setMoveOptions(pokemon, index, { crit: !options.crit }))}
                    title={t('calc.pokemon.critical')}
                  >
                    {t('calc.pokemon.crit')}
                  </ToggleChip>
                  {hits && (
                    <select
                      className={styles.hitsSelect}
                      value={options.hits ?? hits.usual}
                      aria-label={t('calc.pokemon.hits')}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        onChange(
                          setMoveOptions(pokemon, index, { hits: value === hits.usual ? null : value }),
                        );
                      }}
                    >
                      {Array.from({ length: hits.max - hits.min + 1 }, (_, i) => hits.min + i).map(
                        (count) => (
                          <option key={count} value={count}>
                            {t('calc.pokemon.hitsCount', { count })}
                          </option>
                        ),
                      )}
                    </select>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}
