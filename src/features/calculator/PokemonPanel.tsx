import { Replace, Trash2, Users } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Form, Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import {
  ALLIES_FAINTED_ABILITY,
  STATUSES,
  SWITCHED_ABILITIES,
  activeAbility,
  activeForms,
  battleFormsOf,
  calcPokemonFromMember,
  calcStats,
  changeCalcPokemon,
  currentHp,
  newCalcPokemon,
  setBattleForm,
  updateCalcSet,
  type ActiveForms,
  type CalcPokemon,
  type SideId,
  type Status,
} from '@/domain/calculator';
import type { DamageContext } from '@/domain/damage/calculate';
import type { TeamMember } from '@/domain/team';
import { genderRule } from '@/domain/teamEditing';
import { useGameText } from '@/i18n/useGameText';
import { PokemonPicker } from '@/features/team-builder/PokemonPicker';
import { useAlignmentOptions, useItemOptions } from '@/features/team-builder/useFieldOptions';
import { ArtImage } from '@/ui/components/ArtImage';
import { Button } from '@/ui/components/Button';
import { SearchSelect } from '@/ui/components/SearchSelect';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { Switch } from '@/ui/components/Switch';
import { TypeList } from '@/ui/components/TypeBadge';
import { useFormLabels } from '@/ui/useFormLabels';
import { MoveSlots } from './MoveSlots';
import { StatsTable } from './StatsTable';
import { TeamMemberDialog } from './TeamMemberDialog';
import styles from './Calculator.module.css';

interface PokemonPanelProps {
  side: SideId;
  pokemon: CalcPokemon | null;
  ctx: DamageContext;
  /** Show the gender choice (Rivalry is in play). */
  showGender: boolean;
  onChange(next: CalcPokemon | null): void;
}

type Dialog = 'picker' | 'team' | null;

/** One side's Pokémon: who it is, its build and its state in battle. */
export function PokemonPanel({ side, pokemon, ctx, showGender, onChange }: PokemonPanelProps) {
  const { t } = useTranslation();
  const data = useGameData();
  const titleId = useId();
  const [dialog, setDialog] = useState<Dialog>(null);
  const forms = pokemon ? activeForms(pokemon, data) : null;

  const choose = (form: Form) => {
    setDialog(null);
    onChange(pokemon ? changeCalcPokemon(pokemon, form, data) : newCalcPokemon(form, data));
  };
  const load = (member: TeamMember) => {
    setDialog(null);
    onChange(calcPokemonFromMember(member, data));
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.panelTitle}>
        {t(`calc.sides.${side}`)}
      </h2>
      {pokemon && forms ? (
        <PanelBody
          pokemon={pokemon}
          forms={forms}
          ctx={ctx}
          showGender={showGender}
          onChange={onChange}
          onPick={() => setDialog('picker')}
          onLoad={() => setDialog('team')}
        />
      ) : (
        <div className={styles.emptyPanel}>
          {pokemon && <p className={styles.muted}>{t('calc.pokemon.missing', { id: pokemon.set.formId })}</p>}
          <div className={styles.panelActions}>
            <Button variant="primary" onClick={() => setDialog('picker')}>
              {t('calc.pokemon.choose')}
            </Button>
            <Button onClick={() => setDialog('team')}>
              <Users size={17} aria-hidden="true" />
              {t('calc.pokemon.fromTeam')}
            </Button>
          </div>
        </div>
      )}
      <PokemonPicker
        open={dialog === 'picker'}
        title={t(`calc.pokemon.pick.${side}`)}
        current={pokemon?.set.formId ?? null}
        onSelect={choose}
        onClose={() => setDialog(null)}
      />
      <TeamMemberDialog
        open={dialog === 'team'}
        title={t(`calc.pokemon.pick.${side}`)}
        onSelect={load}
        onClose={() => setDialog(null)}
      />
    </section>
  );
}

function PanelBody({
  pokemon,
  forms,
  ctx,
  showGender,
  onChange,
  onPick,
  onLoad,
}: {
  pokemon: CalcPokemon;
  forms: ActiveForms;
  ctx: DamageContext;
  showGender: boolean;
  onChange(next: CalcPokemon | null): void;
  onPick(): void;
  onLoad(): void;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const { active } = forms;
  const label = labels.get(active.id) ?? null;
  const change = (next: CalcPokemon) => onChange(next);
  const changeSet = (update: (set: CalcPokemon['set']) => CalcPokemon['set']) =>
    onChange(updateCalcSet(pokemon, update, data));

  return (
    <div className={styles.panelBody}>
      <div className={styles.identity}>
        <ArtImage
          keys={[active.art.icon, active.art.official]}
          alt=""
          width={64}
          height={64}
          className={styles.identityArt}
        />
        <div className={styles.identityText}>
          <p className={styles.pokemonName}>{text.name('pokemon-names', active.speciesId)}</p>
          {label && <p className={styles.pokemonForm}>{label}</p>}
          <TypeList types={active.types} size="sm" />
        </div>
      </div>
      <div className={styles.panelActions}>
        <Button variant="quiet" onClick={onPick}>
          <Replace size={17} aria-hidden="true" />
          {t('calc.pokemon.change')}
        </Button>
        <Button variant="quiet" onClick={onLoad}>
          <Users size={17} aria-hidden="true" />
          {t('calc.pokemon.fromTeam')}
        </Button>
        <Button variant="quiet" onClick={() => onChange(null)}>
          <Trash2 size={17} aria-hidden="true" />
          {t('calc.pokemon.remove')}
        </Button>
      </div>

      <BattleForm pokemon={pokemon} forms={forms} onChange={change} />
      <div className={styles.fieldGrid}>
        <AbilityChoice pokemon={pokemon} forms={forms} onChange={change} />
        <ItemChoice pokemon={pokemon} onChangeItem={(itemId) => changeSet((set) => ({ ...set, itemId }))} />
        <AlignmentChoice
          alignmentId={pokemon.set.alignmentId}
          onChangeAlignment={(alignmentId) => changeSet((set) => ({ ...set, alignmentId }))}
        />
        {showGender && <GenderChoice pokemon={pokemon} forms={forms} onChange={change} />}
      </div>
      <StatsTable pokemon={pokemon} forms={forms} onChange={change} />
      <BattleState pokemon={pokemon} forms={forms} onChange={change} />
      <MoveSlots pokemon={pokemon} forms={forms} ctx={ctx} onChange={change} />
    </div>
  );
}

/** Its regular form or a battle form: Mega Evolved, Blade Forme… */
function BattleForm({
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
  const text = useGameText();
  const labels = useFormLabels();
  const battleForms = battleFormsOf(pokemon.set, data);
  if (battleForms.length === 0) return null;
  const regular = labels.get(forms.gameplay.id) ?? text.name('pokemon-names', forms.gameplay.speciesId);
  const options = [
    { value: '', label: regular },
    ...battleForms.map((form) => ({
      value: form.id,
      label: labels.get(form.id) ?? text.name('form-names', form.id),
    })),
  ];
  return (
    <SegmentedControl
      label={t('calc.pokemon.form')}
      options={options}
      value={forms.active.id === forms.gameplay.id ? '' : forms.active.id}
      onChange={(value) => onChange(setBattleForm(pokemon, value || null, data))}
    />
  );
}

function AbilityChoice({
  pokemon,
  forms,
  onChange,
}: {
  pokemon: CalcPokemon;
  forms: ActiveForms;
  onChange(next: CalcPokemon): void;
}) {
  const { t } = useTranslation();
  const text = useGameText();
  const id = useId();
  const current = activeAbility(pokemon, forms);
  // A battle form with an Ability of its own (a Mega's) can't change it.
  const own = forms.active.id !== forms.gameplay.id && forms.active.abilities.length > 0;
  const options = own ? forms.active.abilities : [...forms.gameplay.abilities];
  if (!own && current !== null && !options.includes(current)) options.push(current);

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{t('terms.ability')}</label>
      <select
        id={id}
        value={current ?? ''}
        disabled={own && options.length <= 1}
        onChange={(event) =>
          onChange({
            ...pokemon,
            set: { ...pokemon.set, abilityId: event.target.value || null },
            abilityOn: false,
            alliesFainted: 0,
          })
        }
      >
        {current === null && <option value="">{t('common.unknown')}</option>}
        {options.map((ability) => (
          <option key={ability} value={ability}>
            {text.name('ability-names', ability)}
          </option>
        ))}
      </select>
      <AbilityState pokemon={pokemon} ability={current} onChange={onChange} />
    </div>
  );
}

/** For Abilities that only work once triggered: whether they are. */
function AbilityState({
  pokemon,
  ability,
  onChange,
}: {
  pokemon: CalcPokemon;
  ability: Id | null;
  onChange(next: CalcPokemon): void;
}) {
  const { t } = useTranslation();
  const id = useId();
  if (ability === ALLIES_FAINTED_ABILITY) {
    return (
      <div className={styles.inlineField}>
        <label htmlFor={id}>{t('calc.pokemon.alliesFainted')}</label>
        <select
          id={id}
          value={pokemon.alliesFainted}
          onChange={(event) => onChange({ ...pokemon, alliesFainted: Number(event.target.value) })}
        >
          {[0, 1, 2, 3, 4, 5].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (ability === null || !SWITCHED_ABILITIES.has(ability)) return null;
  return (
    <Switch
      checked={pokemon.abilityOn}
      onChange={(abilityOn) => onChange({ ...pokemon, abilityOn })}
      className={styles.abilitySwitch}
    >
      {t(`calc.pokemon.abilityOn.${ability}`, { defaultValue: t('calc.pokemon.abilityOn.other') })}
    </Switch>
  );
}

function ItemChoice({
  pokemon,
  onChangeItem,
}: {
  pokemon: CalcPokemon;
  onChangeItem(itemId: Id | null): void;
}) {
  const { t } = useTranslation();
  const options = useItemOptions(pokemon.set.formId, pokemon.set.itemId);
  return (
    <div className={styles.field}>
      <SearchSelect
        label={t('terms.heldItem')}
        options={options}
        value={pokemon.set.itemId}
        onChange={onChangeItem}
        placeholder={t('calc.pokemon.noItem')}
        noMatches={t('teamEditor.member.noItemMatches')}
        clearLabel={t('teamEditor.member.clearItem')}
        maxResults={300}
      />
    </div>
  );
}

function AlignmentChoice({
  alignmentId,
  onChangeAlignment,
}: {
  alignmentId: Id | null;
  onChangeAlignment(alignmentId: Id | null): void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const options = useAlignmentOptions();
  const known = alignmentId === null || options.some((option) => option.id === alignmentId);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{t('terms.statAlignment')}</label>
      <select
        id={id}
        value={alignmentId ?? ''}
        onChange={(event) => onChangeAlignment(event.target.value || null)}
      >
        <option value="">{t('calc.pokemon.noAlignment')}</option>
        {!known && alignmentId !== null && <option value={alignmentId}>{alignmentId}</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type GenderValue = 'male' | 'female' | 'unknown';

/** For Rivalry, which depends on both Pokémon's genders. */
function GenderChoice({
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
  const rule = genderRule(forms.chosen, data);
  if (rule.kind === 'fixed') {
    return (
      <p className={styles.fixedValue}>
        <span>{t('pokemon.genderLabel')}</span>{' '}
        <strong>{rule.gender ? t(`terms.${rule.gender}`) : t('terms.genderless')}</strong>
      </p>
    );
  }
  return (
    <SegmentedControl<GenderValue>
      label={t('pokemon.genderLabel')}
      options={[
        { value: 'male', label: t('terms.male') },
        { value: 'female', label: t('terms.female') },
        { value: 'unknown', label: t('calc.pokemon.genderUnknown') },
      ]}
      value={pokemon.set.gender ?? 'unknown'}
      onChange={(value) =>
        onChange({ ...pokemon, set: { ...pokemon.set, gender: value === 'unknown' ? null : value } })
      }
    />
  );
}

/** Status condition and remaining HP. */
function BattleState({
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
  const statusId = useId();
  const hpId = useId();
  const maxHp = calcStats(pokemon, forms, data).hp;
  const hp = currentHp(maxHp, pokemon.hpPercent);
  const setPercent = (value: number) =>
    onChange({
      ...pokemon,
      hpPercent: Math.max(1, Math.min(100, Math.round(Number.isFinite(value) ? value : 100))),
    });

  return (
    <div className={styles.battleState}>
      <div className={styles.field}>
        <label htmlFor={statusId}>{t('calc.pokemon.status')}</label>
        <select
          id={statusId}
          value={pokemon.status ?? ''}
          onChange={(event) =>
            onChange({ ...pokemon, status: (event.target.value || null) as Status | null })
          }
        >
          <option value="">{t('calc.statuses.none')}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`calc.statuses.${status}`)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={hpId}>{t('calc.pokemon.hp')}</label>
        <div className={styles.hpRow}>
          <input
            type="range"
            className={styles.hpSlider}
            min={1}
            max={100}
            step={1}
            value={pokemon.hpPercent}
            aria-label={t('calc.pokemon.hpPercent')}
            onChange={(event) => setPercent(event.target.valueAsNumber)}
          />
          <input
            id={hpId}
            type="number"
            className={styles.hpInput}
            inputMode="numeric"
            min={1}
            max={100}
            value={pokemon.hpPercent}
            onChange={(event) => setPercent(event.target.valueAsNumber)}
          />
          <span className={styles.hpUnit}>%</span>
        </div>
        <p className={styles.hint}>{t('calc.pokemon.hpValue', { hp, max: maxHp })}</p>
      </div>
    </div>
  );
}
