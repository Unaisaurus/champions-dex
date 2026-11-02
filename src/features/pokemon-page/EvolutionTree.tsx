import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { FamilyNode, Id, Species } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import { useFormLabels } from '@/ui/useFormLabels';
import { useEvolutionText } from './useEvolutionText';
import styles from './EvolutionTree.module.css';

/** One Pokémon in the tree: art, name and form, linking to its page. */
function Member({ formId, current }: { formId: Id; current: ReadonlySet<Id> }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const form = data.formsById.get(formId);
  if (!form) return null;
  const name = text.name('pokemon-names', form.speciesId);
  const label = labels.get(form.id) ?? null;
  const outside = form.availability !== 'champions';
  const isCurrent = current.has(form.id);
  return (
    <Link
      to={`/pokemon/${form.id}`}
      className={`${styles.member} ${outside ? styles.outside : ''}`}
      aria-current={isCurrent ? 'page' : undefined}
    >
      <ArtImage keys={[form.art.official, form.art.icon]} alt="" width={88} height={88} />
      <span className={styles.memberName}>{name}</span>
      {label && <span className={styles.memberForm}>{label}</span>}
      {outside && <span className={styles.memberTag}>{t('pokemon.evolution.notInChampions')}</span>}
    </Link>
  );
}

function Branch({ node, current }: { node: FamilyNode; current: ReadonlySet<Id> }) {
  const describe = useEvolutionText();
  return (
    <div className={styles.branch}>
      <Member formId={node.form} current={current} />
      {node.children.length > 0 && (
        <ul className={styles.children}>
          {node.children.map((child) => (
            <li key={child.form} className={styles.child}>
              <span className={styles.method}>
                <ArrowRight size={18} aria-hidden="true" className={styles.arrow} />
                <span>{describe(child.conditions)}</span>
              </span>
              <Branch node={child} current={current} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The whole evolution family, Bulbapedia style: each Pokémon with its art and
 * how it evolves. Members outside Champions are included and marked.
 */
export function EvolutionTree({ species, current }: { species: Species; current: ReadonlySet<Id> }) {
  const { t } = useTranslation();
  const data = useGameData();
  const family = data.familiesById.get(species.familyId);
  if (!family) return null;
  const single = family.roots.length === 1 && family.roots[0]?.children.length === 0;

  return (
    <section className={styles.section} aria-labelledby="evolutions">
      <h2 id="evolutions">{t('pokemon.evolution.title')}</h2>
      {single ? (
        <p className={styles.none}>{t('pokemon.evolution.none')}</p>
      ) : (
        <div className={styles.trees}>
          {family.roots.map((root) => (
            <Branch key={root.form} node={root} current={current} />
          ))}
        </div>
      )}
    </section>
  );
}
