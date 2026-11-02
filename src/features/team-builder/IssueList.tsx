import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ValidationIssue } from '@/domain/validation';
import { useIssueText } from './useIssueText';
import styles from './IssueList.module.css';

const ICONS = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;

/** Problems found by the team checks, next to the part of the team they're about. */
export function IssueList({
  issues,
  id,
  className,
}: {
  issues: readonly ValidationIssue[];
  /** For aria-describedby on the field the issues are about. */
  id?: string;
  className?: string;
}) {
  const format = useIssueText();
  if (issues.length === 0) return null;
  // The same sentence can come up twice (a move chosen twice); show it once.
  const unique = new Map(issues.map((issue) => [`${issue.severity}:${format(issue)}`, issue]));
  return (
    <ul id={id} className={`${styles.list} ${className ?? ''}`}>
      {[...unique.entries()].map(([key, issue]) => {
        const Icon = ICONS[issue.severity];
        return (
          <li key={key} className={`${styles.issue} ${styles[issue.severity]}`}>
            <Icon size={16} aria-hidden="true" className={styles.icon} />
            <span>{format(issue)}</span>
          </li>
        );
      })}
    </ul>
  );
}
