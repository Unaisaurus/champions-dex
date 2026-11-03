import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form, Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { MAX_STAGE } from '@/domain/calculator';
import { buildSearchText, matchesSearch } from '@/domain/search';
import {
  CHOICE_SCARF,
  SPEED_SPREADS,
  memberSpeeds,
  sortBySpeed,
  speedTierForms,
  speedTiers,
  type SpeedSpread,
  type SpeedTierEntry,
} from '@/domain/speed';
import type { Team } from '@/domain/team';
import { selectableForms } from '@/domain/teamEditing';
import { useGameText } from '@/i18n/useGameText';
import { useTeams } from '@/state/userData';
import { useSpeedTiers, type SideModifiers } from '@/state/speedTiers';
import { ArtImage } from '@/ui/components/ArtImage';
import { Switch } from '@/ui/components/Switch';
import { ToggleChip } from '@/ui/components/ToggleChip';
import { formSearchNames } from '@/ui/searchNames';
import { useFormLabels } from '@/ui/useFormLabels';
import { CalcHeader } from './CalcHeader';
import { formDisplayName } from './names';
import styles from './SpeedTiers.module.css';

const STAGES = Array.from({ length: MAX_STAGE * 2 + 1 }, (_, index) => MAX_STAGE - index);
const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');

/**
 * Speed tiers: every Pokémon in Champions at the usual Speed spreads, fastest
 * first, with your own team's members marked among them.
 */
export function SpeedTiersPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const teams = useTeams();
  const settings = useSpeedTiers();
  const [query, setQuery] = useState('');
  const searchId = useId();

  const team = teams?.find((entry) => entry.id === settings.teamId) ?? null;
  const forms = useMemo(() => speedTierForms(selectableForms(data), data.formsById, data.megaBase), [data]);
  const searchIndex = useMemo(
    () =>
      new Map(
        forms.map((form) => [
          form.id,
          buildSearchText(formSearchNames(form.id, form.speciesId, data, text, labels)),
        ]),
      ),
    [forms, data, text, labels],
  );

  const entries = useMemo(() => {
    const typed = query.trim();
    const shown = typed
      ? forms.filter((form) => matchesSearch(searchIndex.get(form.id) ?? '', typed))
      : forms;
    const others = speedTiers(shown, settings.spreads, settings.theirs, data.rules);
    const mine = team ? memberSpeeds(team.members, data, settings.ours) : [];
    return sortBySpeed([...mine, ...others], settings.trickRoom);
  }, [query, forms, searchIndex, settings, data, team]);

  return (
    <div className={styles.page}>
      <CalcHeader intro={t('calc.speed.intro', { level: data.rules.level })} />
      <section className={styles.controls} aria-label={t('calc.speed.options')}>
        <div className={styles.controlRow} role="group" aria-labelledby={`${searchId}-spreads`}>
          <span id={`${searchId}-spreads`} className={styles.controlLabel}>
            {t('calc.speed.spreadsLabel')}
          </span>
          {SPEED_SPREADS.map((spread) => (
            <ToggleChip
              key={spread}
              pressed={settings.spreads.includes(spread)}
              onToggle={() => settings.toggleSpread(spread)}
            >
              {spreadLabel(spread, t, data.rules.statPoints.perStat)}
            </ToggleChip>
          ))}
        </div>
        <Modifiers
          title={t('calc.speed.theirs')}
          modifiers={settings.theirs}
          withScarf
          onChange={(change) => settings.setModifiers('theirs', change)}
        />
        <TeamChoice teams={teams} teamId={team?.id ?? null} onChange={settings.setTeam} />
        {team && (
          <Modifiers
            title={t('calc.speed.ours')}
            modifiers={settings.ours}
            withScarf={false}
            onChange={(change) => settings.setModifiers('ours', change)}
          />
        )}
        <div className={styles.controlRow}>
          <Switch checked={settings.trickRoom} onChange={settings.setTrickRoom}>
            {t('calc.speed.trickRoom')}
          </Switch>
        </div>
        <div className={styles.search}>
          <Search size={18} aria-hidden="true" className={styles.searchIcon} />
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder={t('calc.speed.search')}
            aria-label={t('calc.speed.search')}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      <p className={styles.count} aria-live="polite">
        {settings.trickRoom ? t('calc.speed.orderTrickRoom') : t('calc.speed.order')}
      </p>
      {entries.length === 0 ? (
        <p className={styles.empty}>{t('calc.speed.none')}</p>
      ) : (
        <ol className={styles.tiers}>
          {entries.map((entry, index) => (
            <TierRow
              key={entry.key}
              entry={entry}
              team={team}
              tie={index > 0 && entries[index - 1]?.speed === entry.speed}
              names={{ text, labels }}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function spreadLabel(
  spread: SpeedSpread,
  t: ReturnType<typeof useTranslation>['t'],
  perStat: number,
): string {
  return t(`calc.speed.spreads.${spread}`, { points: perStat });
}

function Modifiers({
  title,
  modifiers,
  withScarf,
  onChange,
}: {
  title: string;
  modifiers: SideModifiers;
  withScarf: boolean;
  onChange(change: Partial<SideModifiers>): void;
}) {
  const { t } = useTranslation();
  const stageId = useId();
  return (
    <div className={styles.controlRow} role="group" aria-label={title}>
      <span className={styles.controlLabel}>{title}</span>
      <span className={styles.inlineField}>
        <label htmlFor={stageId}>{t('calc.speed.stage')}</label>
        <select
          id={stageId}
          value={modifiers.stage}
          onChange={(event) => onChange({ stage: Number(event.target.value) })}
        >
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {signed(stage)}
            </option>
          ))}
        </select>
      </span>
      <ToggleChip pressed={modifiers.tailwind} onToggle={() => onChange({ tailwind: !modifiers.tailwind })}>
        {t('calc.field.tailwind')}
      </ToggleChip>
      {withScarf && (
        <ToggleChip
          pressed={modifiers.choiceScarf}
          onToggle={() => onChange({ choiceScarf: !modifiers.choiceScarf })}
        >
          {t('calc.speed.choiceScarf')}
        </ToggleChip>
      )}
      <ToggleChip
        pressed={modifiers.paralysis}
        onToggle={() => onChange({ paralysis: !modifiers.paralysis })}
      >
        {t('calc.speed.paralysis')}
      </ToggleChip>
    </div>
  );
}

function TeamChoice({
  teams,
  teamId,
  onChange,
}: {
  teams: Team[] | undefined;
  teamId: string | null;
  onChange(teamId: string | null): void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const usable = (teams ?? []).filter((team) => team.members.length > 0);
  return (
    <div className={styles.controlRow}>
      <span className={styles.inlineField}>
        <label htmlFor={id} className={styles.controlLabel}>
          {t('calc.speed.team')}
        </label>
        <select id={id} value={teamId ?? ''} onChange={(event) => onChange(event.target.value || null)}>
          <option value="">{t('calc.speed.noTeam')}</option>
          {usable.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </span>
      {teams !== undefined && usable.length === 0 && (
        <span className={styles.hint}>
          {t('calc.speed.noTeams')} <Link to="/teams">{t('nav.teams')}</Link>
        </span>
      )}
    </div>
  );
}

function TierRow({
  entry,
  team,
  tie,
  names,
}: {
  entry: SpeedTierEntry;
  team: Team | null;
  tie: boolean;
  names: { text: ReturnType<typeof useGameText>; labels: ReadonlyMap<Id, string | null> };
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const form = data.formsById.get(entry.formId);
  if (!form) return null;
  const member = entry.memberId
    ? team?.members.find((candidate) => candidate.id === entry.memberId)
    : undefined;
  const name = member?.nickname.trim() || formDisplayName(form, names.text, names.labels);
  return (
    <li className={`${styles.tier} ${member ? styles.mine : ''} ${tie ? styles.tie : ''}`}>
      <span className={styles.speed}>
        {tie ? <span className="visually-hidden">{entry.speed}</span> : entry.speed}
      </span>
      <ArtImage
        keys={[form.art.icon, form.art.official]}
        alt=""
        width={40}
        height={40}
        className={styles.icon}
      />
      <span className={styles.name}>
        <span>{name}</span>
        {member && member.nickname.trim() && (
          <span className={styles.detail}>{formDisplayName(form, names.text, names.labels)}</span>
        )}
      </span>
      <span className={styles.spread}>
        {member ? (
          <MemberSpread form={form} member={member} />
        ) : (
          spreadLabel(entry.spread as SpeedSpread, t, data.rules.statPoints.perStat)
        )}
      </span>
      <span className={styles.base}>{t('calc.speed.base', { base: entry.base })}</span>
    </li>
  );
}

/** A team member's own Speed build: its Stat Points, alignment and Choice Scarf. */
function MemberSpread({ form, member }: { form: Form; member: Team['members'][number] }) {
  const { t } = useTranslation();
  const data = useGameData();
  const alignment = member.alignmentId !== null ? data.alignmentsById.get(member.alignmentId) : undefined;
  const effect =
    alignment && alignment.raises !== alignment.lowers
      ? alignment.raises === 'spe'
        ? t('calc.speed.raised')
        : alignment.lowers === 'spe'
          ? t('calc.speed.lowered')
          : null
      : null;
  const parts = [
    t('calc.speed.yourTeam'),
    t('calc.speed.points', { points: member.statPoints.spe }),
    effect,
    member.itemId === CHOICE_SCARF ? t('calc.speed.choiceScarf') : null,
    form.kind === 'mega' ? t('terms.megaEvolution') : null,
  ].filter(Boolean);
  return <>{parts.join(' · ')}</>;
}
