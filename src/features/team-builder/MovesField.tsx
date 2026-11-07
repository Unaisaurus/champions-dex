import { useId, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form, Id, Move } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import type { TeamMember } from '@/domain/team';
import { moveSlots, setMoveSlot } from '@/domain/teamEditing';
import type { ValidationIssue } from '@/domain/validation';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { SearchSelect, type SearchSelectOption } from '@/ui/components/SearchSelect';
import { TypeBadge } from '@/ui/components/TypeBadge';
import { IssueList } from './IssueList';
import type { MemberChange } from './types';
import { useLearnableMoveOptions, useMoveSlotOptions } from './useFieldOptions';
import styles from './TeamEditor.module.css';

/** The member's moves: each slot offers only what it can learn in Champions. */
export function MovesField({
  member,
  form,
  issues,
  onChange,
}: {
  member: TeamMember;
  form: Form;
  issues: readonly ValidationIssue[];
  onChange: MemberChange;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const titleId = useId();
  const slots = useMemo(() => moveSlots(member.moves, data.rules), [member.moves, data.rules]);
  const learnable = useLearnableMoveOptions(form);
  const slotOptions = useMoveSlotOptions(learnable, slots);

  const ofMove = (move: Id) => issues.filter((issue) => issue.params?.move === move);
  const general = issues.filter((issue) => typeof issue.params?.move !== 'string');

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.panelTitle}>
        {t('terms.moves')}
      </h3>
      <ol className={styles.moveSlots}>
        {slots.map((moveId, index) => {
          const move = moveId !== null ? data.movesById.get(moveId) : undefined;
          const slotIssues = moveId !== null ? ofMove(moveId) : [];
          return (
            <MoveSlot
              key={index}
              index={index}
              moveId={moveId}
              move={move}
              options={slotOptions[index] ?? learnable}
              issues={slotIssues}
              onChange={(id) => onChange((current) => setMoveSlot(current, index, id, data.rules))}
            />
          );
        })}
      </ol>
      <IssueList issues={general} />
    </section>
  );
}

function MoveSlot({
  index,
  moveId,
  move,
  options,
  issues,
  onChange,
}: {
  index: number;
  moveId: Id | null;
  move: Move | undefined;
  options: readonly SearchSelectOption[];
  issues: readonly ValidationIssue[];
  onChange(move: Id | null): void;
}) {
  const { t } = useTranslation();
  const issuesId = useId();
  return (
    <li className={styles.moveSlot}>
      <span className={styles.moveNumber} aria-hidden="true">
        {index + 1}
      </span>
      <div className={styles.moveBody}>
        <SearchSelect
          label={t('teamEditor.member.moveSlot', { n: index + 1 })}
          labelHidden
          options={options}
          value={moveId}
          onChange={onChange}
          placeholder={t('teamEditor.member.movePlaceholder')}
          noMatches={t('teamEditor.member.noMoveMatches')}
          clearLabel={t('teamEditor.member.clearMove')}
          maxResults={400}
          invalid={issues.some((issue) => issue.severity === 'error')}
          describedBy={issues.length > 0 ? issuesId : undefined}
        />
        {move && <MoveFacts move={move} />}
        <IssueList id={issuesId} issues={issues} />
      </div>
    </li>
  );
}

/** Type, category, power, accuracy, PP and what the move does. */
function MoveFacts({ move }: { move: Move }) {
  const { t } = useTranslation();
  const text = useGameText();
  const percent = new Intl.NumberFormat(localeOf(text.language), { style: 'percent' });
  const description = text.get('move-descriptions', move.id)?.text;
  return (
    <div className={styles.moveFacts}>
      <div className={styles.moveStats}>
        <TypeBadge type={move.type} size="sm" />
        <span>{t(`moveCategories.${move.category}`)}</span>
        <span>
          {t('pokemon.moves.power')} <strong>{move.power ?? '—'}</strong>
        </span>
        <span>
          {t('pokemon.moves.accuracy')}{' '}
          <strong>{move.accuracy === null ? '—' : percent.format(move.accuracy / 100)}</strong>
        </span>
        <span>
          {t('pokemon.moves.pp')} <strong>{move.pp}</strong>
        </span>
        {move.priority !== 0 && (
          <span>
            {t('pokemon.moves.priority')}{' '}
            <strong>{move.priority > 0 ? `+${move.priority}` : move.priority}</strong>
          </span>
        )}
      </div>
      {description && <p className={styles.moveDescription}>{description}</p>}
      <Link to={`/moves/${move.id}`} className={styles.textLink}>
        {t('moves.more', { name: text.name('move-names', move.id) })}
      </Link>
    </div>
  );
}
