import { useId, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form, Item } from '@/data/contracts';
import { validationContextFrom } from '@/data/gameData';
import { useGameData } from '@/data/useGameData';
import type { TeamMember } from '@/domain/team';
import type { ValidationIssue } from '@/domain/validation';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { megaFormWith } from '@/mechanics/mega';
import { ArtImage } from '@/ui/components/ArtImage';
import { SearchSelect, type SearchSelectOption } from '@/ui/components/SearchSelect';
import { TypeList } from '@/ui/components/TypeBadge';
import { useFormLabels } from '@/ui/useFormLabels';
import { useTextSearchIndex } from '@/ui/useTextSearchIndex';
import { IssueList } from './IssueList';
import type { MemberChange } from './types';
import styles from './TeamEditor.module.css';

/**
 * The held item, searchable by name in any language. Mega Stones are only
 * offered to the Pokémon that can use them, and listed first.
 */
export function ItemField({
  member,
  mega,
  issues,
  onChange,
}: {
  member: TeamMember;
  /** The Mega Evolution the held item allows, if any. */
  mega: Form | null;
  issues: readonly ValidationIssue[];
  onChange: MemberChange;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const titleId = useId();
  const issuesId = useId();
  const searchIndex = useTextSearchIndex('item-names', data.items);
  const { formId, itemId: savedItem } = member;

  const options = useMemo<SearchSelectOption[]>(() => {
    const ctx = validationContextFrom(data);
    const fitsMember = (item: Item) => megaFormWith(formId, item.id, ctx) !== null;
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    const option = (item: Item, own: boolean): SearchSelectOption & { own: boolean } => ({
      id: item.id,
      label: text.name('item-names', item.id),
      searchText: searchIndex.get(item.id),
      icon: <ArtImage keys={[item.icon]} alt="" width={28} height={28} className={styles.optionIcon} />,
      detail: own ? <span className={styles.optionTag}>{t('terms.megaEvolution')}</span> : undefined,
      own,
    });
    const usable = data.items
      .filter((item) => item.availableInChampions)
      .flatMap((item) => {
        if (item.megaEvolutions.length === 0) return [option(item, false)];
        return fitsMember(item) ? [option(item, true)] : [];
      })
      .sort((a, b) => Number(b.own) - Number(a.own) || collator.compare(a.label, b.label));
    // The saved item stays visible even if it isn't offered anymore (with its warning).
    if (savedItem !== null && !usable.some((entry) => entry.id === savedItem)) {
      const item = data.itemsById.get(savedItem);
      usable.unshift(
        item
          ? option(item, false)
          : {
              id: savedItem,
              label: savedItem,
              searchText: savedItem,
              icon: null,
              detail: undefined,
              own: false,
            },
      );
    }
    return usable.map(({ id, label, searchText, icon, detail }) => ({ id, label, searchText, icon, detail }));
  }, [data, text, t, searchIndex, formId, savedItem]);

  const item = member.itemId !== null ? data.itemsById.get(member.itemId) : undefined;
  const description = item ? text.get('item-descriptions', item.id)?.text : undefined;
  const invalid = issues.some((issue) => issue.severity === 'error' || issue.severity === 'warning');

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.panelTitle}>
        {t('terms.heldItem')}
      </h3>
      <SearchSelect
        label={t('terms.heldItem')}
        labelHidden
        options={options}
        value={member.itemId}
        onChange={(itemId) => onChange((current) => ({ ...current, itemId }))}
        placeholder={t('teamEditor.member.itemPlaceholder')}
        noMatches={t('teamEditor.member.noItemMatches')}
        clearLabel={t('teamEditor.member.clearItem')}
        maxResults={300}
        invalid={invalid}
        describedBy={issues.length > 0 ? issuesId : undefined}
      />
      {item && (
        <div className={styles.itemCard}>
          <ArtImage keys={[item.icon]} alt="" width={40} height={40} />
          {description && <p>{description}</p>}
        </div>
      )}
      {mega && <MegaPreview mega={mega} />}
      <IssueList id={issuesId} issues={issues} />
    </section>
  );
}

/** What the member turns into when it Mega Evolves. */
function MegaPreview({ mega }: { mega: Form }) {
  const { t } = useTranslation();
  const text = useGameText();
  const labels = useFormLabels();
  const name = labels.get(mega.id) ?? text.name('pokemon-names', mega.speciesId);
  return (
    <div className={styles.mega}>
      <ArtImage keys={[mega.art.icon, mega.art.official]} alt="" width={56} height={56} />
      <div className={styles.megaText}>
        <p>
          {t('teamEditor.member.megaInto')}{' '}
          <Link to={`/pokemon/${mega.id}`} className={styles.megaName}>
            {name}
          </Link>
        </p>
        <div className={styles.megaFacts}>
          <TypeList types={mega.types} size="sm" />
          {mega.abilities.length > 0 && (
            <span>
              {t('terms.ability')}: {mega.abilities.map((id) => text.name('ability-names', id)).join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
