import { ArrowLeftRight, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import {
  SIDES,
  activeAbility,
  activeForms,
  fieldWithAbility,
  type CalcPokemon,
  type SideId,
} from '@/domain/calculator';
import { useCalculator } from '@/state/calculator';
import { Button } from '@/ui/components/Button';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { useFormLabels } from '@/ui/useFormLabels';
import { useGameText } from '@/i18n/useGameText';
import { CalcCredit, CalcHeader } from './CalcHeader';
import { FieldPanel } from './FieldPanel';
import { PokemonPanel } from './PokemonPanel';
import { formDisplayName } from './names';
import { Results } from './Results';
import { useDamageContext, useResults } from './useDamage';
import styles from './Calculator.module.css';

const RIVALRY = 'rivalry';

/**
 * The damage calculator: your Pokémon and the opponent's, the battlefield,
 * and what each move does to the other side, worked out by Smogon's damage
 * calculator with the Champions game data.
 */
export function CalculatorPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const { ours, theirs, field, selected, setPokemon, updateField, select, swap, reset } = useCalculator();
  const pokemon = useMemo(() => ({ ours, theirs }), [ours, theirs]);
  const ctx = useDamageContext(field);
  const { results, speeds } = useResults(ctx, pokemon);
  const text = useGameText();
  const labels = useFormLabels();
  // On narrow screens one panel shows at a time.
  const [shownSide, setShownSide] = useState<SideId>('ours');
  const sideLabel = (side: SideId) => {
    const entry = pokemon[side];
    const forms = entry ? activeForms(entry, data) : null;
    const short = t(`calc.sidesShort.${side}`);
    return forms ? `${short}: ${formDisplayName(forms.active, text, labels)}` : short;
  };

  const abilityOf = (entry: CalcPokemon | null) => {
    const forms = entry ? activeForms(entry, data) : null;
    return entry && forms ? activeAbility(entry, forms) : null;
  };
  // Rivalry depends on both genders, so they can be set when it's in play.
  const showGender = abilityOf(ours) === RIVALRY || abilityOf(theirs) === RIVALRY;

  /** A Pokémon coming in with Drought, Electric Surge… starts its weather or terrain, as in battle. */
  const change = (side: SideId, next: CalcPokemon | null) => {
    const before = abilityOf(pokemon[side]);
    const after = abilityOf(next);
    setPokemon(side, next);
    if (after !== before) updateField((current) => fieldWithAbility(current, after));
  };

  const empty = !ours && !theirs;

  return (
    <div className={styles.page}>
      <CalcHeader intro={t('calc.intro', { level: data.rules.level })} />
      <Results
        pokemon={pokemon}
        results={results}
        speeds={speeds}
        trickRoom={field.trickRoom}
        selected={selected}
        onSelect={select}
      />
      <div className={styles.sideSwitch}>
        <SegmentedControl<SideId>
          label={t('calc.showSide')}
          labelHidden
          options={SIDES.map((side) => ({ value: side, label: sideLabel(side) }))}
          value={shownSide}
          onChange={setShownSide}
        />
      </div>
      <div className={styles.sides} data-shown={shownSide}>
        {SIDES.map((side) => (
          <div key={side} className={styles.sideColumn} data-side={side}>
            <PokemonPanel
              side={side}
              pokemon={pokemon[side]}
              ctx={ctx}
              showGender={showGender}
              onChange={(next) => change(side, next)}
            />
          </div>
        ))}
      </div>
      <div className={styles.pageActions}>
        <Button onClick={swap} disabled={empty}>
          <ArrowLeftRight size={17} aria-hidden="true" />
          {t('calc.swap')}
        </Button>
        <Button variant="quiet" onClick={reset} disabled={empty}>
          <RotateCcw size={17} aria-hidden="true" />
          {t('calc.reset')}
        </Button>
      </div>
      <FieldPanel field={field} onChange={(next) => updateField(() => next)} />
      <CalcCredit />
    </div>
  );
}
