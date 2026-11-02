import { ArrowLeft, ArrowRight, BookOpen, Replace, Trash2 } from 'lucide-react';
import { useId, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { validationContextFrom } from '@/data/gameData';
import type { TeamMember } from '@/domain/team';
import { genderRule, memberLook, type Gender } from '@/domain/teamEditing';
import { gameplayFormOf, type ValidationIssue } from '@/domain/validation';
import { useGameText } from '@/i18n/useGameText';
import { megaFormFor } from '@/mechanics/mega';
import { ArtImage } from '@/ui/components/ArtImage';
import { Button } from '@/ui/components/Button';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { Switch } from '@/ui/components/Switch';
import { TypeList } from '@/ui/components/TypeBadge';
import { useFormLabels } from '@/ui/useFormLabels';
import { AbilityField } from './AbilityField';
import { IssueList } from './IssueList';
import { ItemField } from './ItemField';
import { MovesField } from './MovesField';
import { StatsField } from './StatsField';
import type { MemberChange } from './types';
import styles from './TeamEditor.module.css';

interface MemberEditorProps {
  member: TeamMember;
  /** Position in the team, from 0. */
  index: number;
  /** How many members the team has. */
  memberCount: number;
  /** Every check result about this member. */
  issues: readonly ValidationIssue[];
  onChange: MemberChange;
  onChangePokemon(): void;
  onMove(offset: number): void;
  onRemove(): void;
}

/** The games allow nicknames of up to 12 characters. */
const NICKNAME_LENGTH = 12;

/** Everything about one team member: Pokémon, Ability, item, moves and stats. */
export function MemberEditor(props: MemberEditorProps) {
  const { member, issues } = props;
  const data = useGameData();
  const form = data.formsById.get(member.formId);
  // Info notes ("2 move slots are empty") would only repeat what the empty fields already show.
  const shown = issues.filter((issue) => issue.severity !== 'info');
  const of = (...fields: string[]) => shown.filter((issue) => fields.includes(issue.field ?? ''));

  if (!form) return <MissingForm {...props} issues={of('form')} />;
  const gameplay = gameplayFormOf(form, data.formsById);
  const mega = megaFormFor(member, validationContextFrom(data));

  return (
    <div className={styles.member}>
      <Identity {...props} form={form} gameplay={gameplay} issues={of('form')} />
      <div className={styles.columns}>
        <div className={styles.column}>
          <AbilityField
            member={member}
            gameplay={gameplay}
            issues={of('ability')}
            onChange={props.onChange}
          />
          <ItemField member={member} mega={mega} issues={of('item')} onChange={props.onChange} />
          <MovesField member={member} form={form} issues={of('moves')} onChange={props.onChange} />
        </div>
        <div className={`${styles.column} ${styles.stickyColumn}`}>
          <StatsField
            member={member}
            gameplay={gameplay}
            mega={mega}
            issues={of('statPoints', 'alignment')}
            onChange={props.onChange}
          />
        </div>
      </div>
    </div>
  );
}

function Identity({
  member,
  form,
  gameplay,
  index,
  memberCount,
  issues,
  onChange,
  onChangePokemon,
  onMove,
  onRemove,
}: MemberEditorProps & { form: Form; gameplay: Form }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const titleId = useId();
  const nicknameId = useId();

  const look = memberLook(member, data) ?? form;
  const species = data.speciesById.get(form.speciesId);
  const speciesName = text.name('pokemon-names', form.speciesId);
  const label = labels.get(form.id) ?? null;
  const nickname = member.nickname.trim();
  const colour = gameplay.color ?? species?.color ?? 'gray';
  const artKeys = member.shiny ? [look.art.officialShiny, look.art.official] : [look.art.official];
  const details = [nickname ? speciesName : null, label].filter(Boolean).join(' · ');

  return (
    <section className={styles.identity} aria-labelledby={titleId}>
      <div className={styles.portrait} style={{ '--hero-bg': `var(--dex-${colour})` } as CSSProperties}>
        <ArtImage
          keys={artKeys}
          alt={label ? `${speciesName} (${label})` : speciesName}
          width={240}
          height={240}
          priority
        />
      </div>
      <div className={styles.identityMain}>
        <div className={styles.titleBlock}>
          <p className={styles.slotNumber}>{t('teamEditor.member.slot', { n: index + 1 })}</p>
          <h2 id={titleId} className={styles.memberName}>
            {nickname || speciesName}
          </h2>
          {details && <p className={styles.memberDetails}>{details}</p>}
          <TypeList types={gameplay.types} />
        </div>
        <IssueList issues={issues} />
        <div className={styles.identityActions}>
          <Button onClick={onChangePokemon}>
            <Replace size={18} aria-hidden="true" />
            {t('teamEditor.member.changePokemon')}
          </Button>
          <Link to={`/pokemon/${look.id}`} className={styles.textLink}>
            <BookOpen size={18} aria-hidden="true" />
            {t('teamEditor.member.pokedexPage')}
          </Link>
        </div>
        <div className={styles.identityFields}>
          <div className={styles.textField}>
            <label htmlFor={nicknameId}>{t('teamEditor.member.nickname')}</label>
            <input
              id={nicknameId}
              type="text"
              value={member.nickname}
              maxLength={NICKNAME_LENGTH}
              placeholder={speciesName}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                const value = event.target.value;
                onChange((current) => ({ ...current, nickname: value }));
              }}
            />
          </div>
          <GenderField member={member} form={form} onChange={onChange} />
          <Switch checked={member.shiny} onChange={(shiny) => onChange((current) => ({ ...current, shiny }))}>
            {t('terms.shiny')}
          </Switch>
        </div>
        <div className={styles.memberActions}>
          <Button variant="quiet" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowLeft size={17} aria-hidden="true" />
            {t('teamEditor.member.moveEarlier')}
          </Button>
          <Button variant="quiet" disabled={index >= memberCount - 1} onClick={() => onMove(1)}>
            <ArrowRight size={17} aria-hidden="true" />
            {t('teamEditor.member.moveLater')}
          </Button>
          <Button variant="quiet" onClick={onRemove}>
            <Trash2 size={17} aria-hidden="true" />
            {t('teamEditor.member.remove')}
          </Button>
        </div>
      </div>
    </section>
  );
}

type GenderChoice = Gender | 'unset';

function GenderField({
  member,
  form,
  onChange,
}: {
  member: TeamMember;
  form: Form;
  onChange: MemberEditorProps['onChange'];
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const rule = genderRule(form, data);
  if (rule.kind === 'fixed') {
    return (
      <p className={styles.fixedGender}>
        <span>{t('pokemon.genderLabel')}</span>{' '}
        <strong>{rule.gender ? t(`terms.${rule.gender}`) : t('terms.genderless')}</strong>
      </p>
    );
  }
  return (
    <SegmentedControl<GenderChoice>
      label={t('pokemon.genderLabel')}
      options={[
        { value: 'unset', label: t('teamEditor.member.genderAny') },
        { value: 'male', label: t('terms.male') },
        { value: 'female', label: t('terms.female') },
      ]}
      value={member.gender ?? 'unset'}
      onChange={(value) => onChange((current) => ({ ...current, gender: value === 'unset' ? null : value }))}
    />
  );
}

/** A member whose Pokémon isn't in the game data anymore: it can only be changed or removed. */
function MissingForm({ member, issues, onChangePokemon, onRemove }: MemberEditorProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.panel} aria-label={member.nickname || member.formId}>
      <h2 className={styles.memberName}>{member.nickname || member.formId}</h2>
      <IssueList issues={issues} />
      <div className={styles.identityActions}>
        <Button onClick={onChangePokemon}>
          <Replace size={18} aria-hidden="true" />
          {t('teamEditor.member.changePokemon')}
        </Button>
        <Button variant="quiet" onClick={onRemove}>
          <Trash2 size={17} aria-hidden="true" />
          {t('teamEditor.member.remove')}
        </Button>
      </div>
    </section>
  );
}
