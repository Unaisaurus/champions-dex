import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STAT_IDS, type Id, type StatId } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { alignmentPercent } from '@/domain/stats';
import type { Team, TeamMember } from '@/domain/team';
import {
  analyseMembers,
  coverageTable,
  defenceTable,
  isDamaging,
  speedOrder,
  weakSpots,
  type AnalysedMember,
} from '@/domain/teamAnalysis';
import { memberLook } from '@/domain/teamEditing';
import type { ValidationIssue } from '@/domain/validation';
import { useGameText } from '@/i18n/useGameText';
import { AbilityName } from '@/ui/components/AbilityName';
import { ArtImage } from '@/ui/components/ArtImage';
import { Button } from '@/ui/components/Button';
import { Switch } from '@/ui/components/Switch';
import { TypeBadge, TypeList } from '@/ui/components/TypeBadge';
import { formatMultiplier } from '@/ui/format';
import { useFormLabels } from '@/ui/useFormLabels';
import { IssueList } from './IssueList';
import styles from './TeamOverview.module.css';

interface OverviewProps {
  team: Team;
  issues: readonly ValidationIssue[];
  onEdit(memberId: string): void;
}

/** Names and icons of the members, as the overview shows them. */
function useMemberInfo(team: Team) {
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  return useMemo(() => {
    const info = new Map<
      string,
      { name: string; species: string; label: string | null; icon: (string | null | undefined)[] }
    >();
    for (const member of team.members) {
      const form = data.formsById.get(member.formId);
      const look = memberLook(member, data);
      const species = form ? text.name('pokemon-names', form.speciesId) : member.formId;
      info.set(member.id, {
        name: member.nickname.trim() || species,
        species,
        label: labels.get(member.formId) ?? null,
        icon: member.shiny ? [look?.art.iconShiny, look?.art.icon] : [look?.art.icon, look?.art.official],
      });
    }
    return info;
  }, [team, data, text, labels]);
}

/** The whole team at a glance: problems, each member's build, weaknesses, coverage and speed. */
export function TeamOverview({ team, issues, onEdit }: OverviewProps) {
  const { t } = useTranslation();
  const data = useGameData();
  const info = useMemberInfo(team);
  const [megaEvolved, setMegaEvolved] = useState(false);

  const regular = useMemo(() => analyseMembers(team, data), [team, data]);
  const analysed = useMemo(() => analyseMembers(team, data, { megaEvolved }), [team, data, megaEvolved]);
  const canMega = useMemo(
    () => analyseMembers(team, data, { megaEvolved: true }).some((member) => member.megaEvolved),
    [team, data],
  );

  if (team.members.length === 0) {
    return <p className={styles.empty}>{t('teamEditor.overview.empty')}</p>;
  }

  return (
    <div className={styles.overview}>
      <Checks team={team} issues={issues} info={info} />
      <TeamSheet team={team} members={regular} info={info} onEdit={onEdit} />
      {canMega && (
        <Switch checked={megaEvolved} onChange={setMegaEvolved} className={styles.megaSwitch}>
          {t('teamEditor.overview.megaEvolved')}
        </Switch>
      )}
      <div className={styles.columns}>
        <Defence members={analysed} info={info} />
        <div className={styles.column}>
          <Coverage members={analysed} info={info} />
          <Speed members={analysed} info={info} />
        </div>
      </div>
    </div>
  );
}

type Info = ReturnType<typeof useMemberInfo>;

function MemberIcon({
  memberId,
  info,
  size = 32,
  analysed,
}: {
  memberId: string;
  info: Info;
  size?: number;
  /** When it's counted as its Mega Evolution, the Mega's icon is shown. */
  analysed?: AnalysedMember;
}) {
  const member = info.get(memberId);
  const keys = analysed?.megaEvolved ? [analysed.form.art.icon, analysed.form.art.official] : member?.icon;
  return (
    <ArtImage keys={keys ?? []} alt={member?.name ?? ''} width={size} height={size} className={styles.icon} />
  );
}

/** Every problem the team checks found, member by member. */
function Checks({ team, issues, info }: { team: Team; issues: readonly ValidationIssue[]; info: Info }) {
  const { t } = useTranslation();
  const titleId = useId();
  const serious = issues.filter((issue) => issue.severity !== 'info');
  const teamWide = serious.filter((issue) => !issue.memberId);
  const byMember = team.members
    .map((member) => ({ member, issues: serious.filter((issue) => issue.memberId === member.id) }))
    .filter((entry) => entry.issues.length > 0);
  const unfinished = issues.filter((issue) => issue.severity === 'info' && issue.memberId).length;

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {t('teamEditor.teamChecks')}
      </h2>
      {serious.length === 0 ? (
        <p className={styles.allGood}>{t('teamEditor.overview.noProblems')}</p>
      ) : (
        <div className={styles.checks}>
          {teamWide.length > 0 && <IssueList issues={teamWide} />}
          {byMember.map(({ member, issues: own }) => (
            <div key={member.id} className={styles.checkGroup}>
              <p className={styles.checkName}>
                <MemberIcon memberId={member.id} info={info} size={28} />
                {info.get(member.id)?.name}
              </p>
              <IssueList issues={own} />
            </div>
          ))}
        </div>
      )}
      {unfinished > 0 && (
        <p className={styles.unfinished}>{t('teamEditor.overview.unfinished', { count: unfinished })}</p>
      )}
    </section>
  );
}

/** One card per member with its whole build. */
function TeamSheet({
  team,
  members,
  info,
  onEdit,
}: {
  team: Team;
  members: readonly AnalysedMember[];
  info: Info;
  onEdit(memberId: string): void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={styles.sheetSection}>
      <h2 id={titleId} className={styles.title}>
        {t('teamEditor.overview.sheet')}
      </h2>
      <ol className={styles.sheet}>
        {team.members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            analysed={members.find((entry) => entry.memberId === member.id)}
            info={info}
            onEdit={() => onEdit(member.id)}
          />
        ))}
      </ol>
    </section>
  );
}

function MemberCard({
  member,
  analysed,
  info,
  onEdit,
}: {
  member: TeamMember;
  analysed: AnalysedMember | undefined;
  info: Info;
  onEdit(): void;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const own = info.get(member.id);
  const item = member.itemId !== null ? data.itemsById.get(member.itemId) : undefined;
  const alignment = member.alignmentId !== null ? data.alignmentsById.get(member.alignmentId) : undefined;
  const details = [member.nickname.trim() ? own?.species : null, own?.label].filter(Boolean).join(' · ');
  const chosenMoves = member.moves.filter((move): move is Id => move !== null);

  return (
    <li className={styles.card}>
      <div className={styles.cardHead}>
        <MemberIcon memberId={member.id} info={info} size={64} />
        <div className={styles.cardName}>
          <h3>{own?.name}</h3>
          {details && <p className={styles.muted}>{details}</p>}
          {analysed && <TypeList types={analysed.form.types} size="sm" />}
        </div>
        <Button
          variant="quiet"
          onClick={onEdit}
          aria-label={t('teamEditor.overview.editMember', { name: own?.name })}
        >
          <Pencil size={16} aria-hidden="true" />
          <span className={styles.editLabel}>{t('teamEditor.overview.edit')}</span>
        </Button>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>{t('terms.ability')}</dt>
          <dd>{member.abilityId ? <AbilityName id={member.abilityId} /> : '—'}</dd>
        </div>
        <div>
          <dt>{t('terms.heldItem')}</dt>
          <dd className={styles.item}>
            {item && <ArtImage keys={[item.icon]} alt="" width={24} height={24} />}
            {member.itemId ? text.name('item-names', member.itemId) : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('terms.statAlignment')}</dt>
          <dd>{member.alignmentId ? text.name('alignment-names', member.alignmentId) : '—'}</dd>
        </div>
      </dl>
      {analysed && (
        <dl className={styles.stats}>
          {STAT_IDS.map((stat) => (
            <StatValue
              key={stat}
              stat={stat}
              value={analysed.stats[stat]}
              percent={alignmentPercent(stat, alignment, data.rules)}
            />
          ))}
        </dl>
      )}
      <ul className={styles.moves}>
        {chosenMoves.length === 0 ? (
          <li className={styles.muted}>{t('teamEditor.overview.noMoves')}</li>
        ) : (
          chosenMoves.map((id, index) => {
            const move = data.movesById.get(id);
            return (
              <li key={`${id}-${index}`}>
                <span
                  className={styles.typeDot}
                  style={{ background: `var(--type-${move?.type ?? 'unknown'})` }}
                  aria-hidden="true"
                />
                {text.name('move-names', id)}
              </li>
            );
          })
        )}
      </ul>
    </li>
  );
}

function StatValue({ stat, value, percent }: { stat: StatId; value: number; percent: number }) {
  const { t } = useTranslation();
  const effect =
    percent > 100 ? t('teamEditor.member.raised') : percent < 100 ? t('teamEditor.member.lowered') : null;
  return (
    <div className={percent > 100 ? styles.raised : percent < 100 ? styles.lowered : undefined}>
      <dt>
        {t(`statsShort.${stat}`)}
        {percent > 100 && <ChevronUp size={12} aria-hidden="true" />}
        {percent < 100 && <ChevronDown size={12} aria-hidden="true" />}
        {effect && <span className="visually-hidden">{effect}</span>}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

/** What each attacking type does to each member. */
function Defence({ members, info }: { members: readonly AnalysedMember[]; info: Info }) {
  const { t } = useTranslation();
  const data = useGameData();
  const titleId = useId();
  const rows = useMemo(() => defenceTable(members, data.types), [members, data.types]);
  const spots = weakSpots(rows);
  const spotTypes = new Set(spots.map((row) => row.type));

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {t('teamEditor.overview.defence')}
      </h2>
      <p className={styles.hint}>{t('teamEditor.overview.defenceHint')}</p>
      {spots.length > 0 ? (
        <p className={styles.summary}>
          <span>{t('teamEditor.overview.weakSpots')}</span>
          {spots.map((row) => (
            <TypeBadge key={row.type} type={row.type} size="sm" />
          ))}
        </p>
      ) : (
        <p className={styles.allGood}>{t('teamEditor.overview.noWeakSpots')}</p>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.typeColumn}>
                <span className="visually-hidden">{t('teamEditor.overview.attackingType')}</span>
              </th>
              {members.map((member) => (
                <th key={member.memberId} scope="col">
                  <MemberIcon memberId={member.memberId} info={info} size={30} analysed={member} />
                </th>
              ))}
              <th scope="col" className={styles.count}>
                {t('teamEditor.overview.weak')}
              </th>
              <th scope="col" className={styles.count}>
                {t('teamEditor.overview.resist')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type} className={spotTypes.has(row.type) ? styles.spot : undefined}>
                <th scope="row" className={styles.typeColumn}>
                  <TypeBadge type={row.type} size="sm" />
                </th>
                {row.multipliers.map((multiplier, index) => (
                  <td
                    key={members[index]?.memberId ?? index}
                    className={styles.cell}
                    data-level={level(multiplier)}
                  >
                    {multiplier === 1 ? '' : formatMultiplier(multiplier)}
                  </td>
                ))}
                <td className={`${styles.count} ${row.weak > 0 ? styles.weakCount : ''}`}>
                  {row.weak || ''}
                </td>
                <td className={`${styles.count} ${row.resist > 0 ? styles.resistCount : ''}`}>
                  {row.resist || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A name for each kind of multiplier, used for the cell colours. */
function level(multiplier: number): string {
  if (multiplier === 0) return 'immune';
  if (multiplier >= 4) return 'double-weak';
  if (multiplier > 1) return 'weak';
  if (multiplier <= 0.25) return 'double-resist';
  if (multiplier < 1) return 'resist';
  return 'neutral';
}

/** How hard the team's attacking moves can hit each type. */
function Coverage({ members, info }: { members: readonly AnalysedMember[]; info: Info }) {
  const { t } = useTranslation();
  const data = useGameData();
  const titleId = useId();
  const coverage = useMemo(() => coverageTable(members, data.types), [members, data.types]);
  const hasAttacks = members.some((member) => member.moves.some(isDamaging));
  const uncovered = coverage.filter((entry) => entry.best !== null && entry.best <= 1);

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {t('teamEditor.overview.coverage')}
      </h2>
      <p className={styles.hint}>{t('teamEditor.overview.coverageHint')}</p>
      {!hasAttacks ? (
        <p className={styles.muted}>{t('teamEditor.overview.noAttacks')}</p>
      ) : (
        <>
          {uncovered.length > 0 ? (
            <p className={styles.summary}>
              <span>{t('teamEditor.overview.notCovered')}</span>
              {uncovered.map((entry) => (
                <TypeBadge key={entry.type} type={entry.type} size="sm" />
              ))}
            </p>
          ) : (
            <p className={styles.allGood}>{t('teamEditor.overview.allCovered')}</p>
          )}
          <ul className={styles.coverage}>
            {coverage.map((entry) => (
              <li key={entry.type} data-covered={entry.members.length > 0 || undefined}>
                <TypeBadge type={entry.type} size="sm" />
                <span className={styles.best}>
                  {entry.best === null ? '—' : formatMultiplier(entry.best)}
                </span>
                <span className={styles.hitters}>
                  {entry.members.map((memberId) => (
                    <MemberIcon
                      key={memberId}
                      memberId={memberId}
                      info={info}
                      size={24}
                      analysed={members.find((member) => member.memberId === memberId)}
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Who moves first: the Speed stat of each member, fastest first. */
function Speed({ members, info }: { members: readonly AnalysedMember[]; info: Info }) {
  const { t } = useTranslation();
  const titleId = useId();
  const order = speedOrder(members);
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {t('teamEditor.overview.speed')}
      </h2>
      <ol className={styles.speed}>
        {order.map((entry) => (
          <li key={entry.memberId}>
            <MemberIcon
              memberId={entry.memberId}
              info={info}
              size={32}
              analysed={members.find((member) => member.memberId === entry.memberId)}
            />
            <span className={styles.speedName}>{info.get(entry.memberId)?.name}</span>
            <span className={styles.speedValue}>{entry.withScarf ?? entry.speed}</span>
            {entry.withScarf !== null && (
              <span className={styles.scarf}>
                {t('teamEditor.overview.withScarf', { speed: entry.speed })}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
