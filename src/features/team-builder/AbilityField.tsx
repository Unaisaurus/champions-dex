import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Form } from '@/data/contracts';
import type { TeamMember } from '@/domain/team';
import type { ValidationIssue } from '@/domain/validation';
import { useGameText } from '@/i18n/useGameText';
import { IssueList } from './IssueList';
import type { MemberChange } from './types';
import styles from './TeamEditor.module.css';

/** The member's Ability, picked from the ones its form can have, with what each does. */
export function AbilityField({
  member,
  gameplay,
  issues,
  onChange,
}: {
  member: TeamMember;
  gameplay: Form;
  issues: readonly ValidationIssue[];
  onChange: MemberChange;
}) {
  const { t } = useTranslation();
  const text = useGameText();
  const titleId = useId();
  const name = useId();
  const options = [...gameplay.abilities];
  // A saved Ability that isn't an option anymore stays visible, with its warning.
  if (member.abilityId !== null && !options.includes(member.abilityId)) options.push(member.abilityId);

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.panelTitle}>
        {t('terms.ability')}
      </h3>
      <div role="radiogroup" aria-labelledby={titleId} className={styles.choices}>
        {options.map((ability) => (
          <label key={ability} className={styles.choice}>
            <input
              type="radio"
              name={name}
              value={ability}
              checked={member.abilityId === ability}
              onChange={() => onChange((current) => ({ ...current, abilityId: ability }))}
            />
            <span className={styles.choiceText}>
              <span className={styles.choiceName}>{text.name('ability-names', ability)}</span>
              <span className={styles.choiceDescription}>
                {text.get('ability-descriptions', ability)?.text}
              </span>
            </span>
          </label>
        ))}
      </div>
      <IssueList issues={issues} />
    </section>
  );
}
