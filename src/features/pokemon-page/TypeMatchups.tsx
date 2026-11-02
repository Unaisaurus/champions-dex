import { useTranslation } from 'react-i18next';
import type { Form, Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { abilityMatchupNotes } from '@/domain/abilityMatchups';
import { defensiveProfile } from '@/domain/typeEffectiveness';
import { useGameText } from '@/i18n/useGameText';
import { TypeBadge } from '@/ui/components/TypeBadge';
import { formatMultiplier } from '@/ui/format';
import styles from './PokemonPage.module.css';

function TypeWithMultiplier({ type, multiplier }: { type: Id; multiplier: number }) {
  return (
    <span className={styles.matchup}>
      <TypeBadge type={type} size="sm" />
      <span className={styles.multiplier}>{formatMultiplier(multiplier)}</span>
    </span>
  );
}

/** How much damage each type does to this form, plus Abilities that change it. */
export function TypeMatchups({ form }: { form: Form }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const profile = defensiveProfile(form.types, data.types);
  const notes = abilityMatchupNotes(form.types, form.abilities, data.types);
  const multiplier = (type: Id) => profile.multipliers[type] ?? 1;

  const groups = [
    { key: 'weak', types: profile.weaknesses },
    { key: 'resists', types: profile.resistances },
    { key: 'immune', types: profile.immunities },
  ] as const;

  return (
    <section className={styles.panel} aria-labelledby="matchups">
      <h2 id="matchups">{t('pokemon.matchups.title')}</h2>
      <p className={styles.panelHint}>{t('pokemon.matchups.hint')}</p>
      <dl className={styles.matchupGroups}>
        {groups.map(({ key, types }) => (
          <div key={key}>
            <dt>{t(`pokemon.matchups.${key}`)}</dt>
            <dd>
              {types.length === 0 ? (
                <span className={styles.none}>{t('pokemon.matchups.none')}</span>
              ) : (
                types.map((type) => (
                  <TypeWithMultiplier key={type} type={type} multiplier={multiplier(type)} />
                ))
              )}
            </dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && (
        <ul className={styles.abilityNotes}>
          {notes.map((note) => (
            <li key={note.ability}>
              <strong>{text.name('ability-names', note.ability)}</strong>
              {note.changes.map((change) => (
                <span key={change.type} className={styles.matchup}>
                  <TypeBadge type={change.type} size="sm" />
                  <span className={styles.multiplier}>
                    {formatMultiplier(change.before)} → {formatMultiplier(change.after)}
                  </span>
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
