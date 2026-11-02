import { CirclePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Form } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { memberStartFor } from '@/domain/teamEditing';
import { openAddToTeam } from '@/state/addToTeam';
import { Button } from './Button';
import styles from './FavouriteButton.module.css';

/**
 * Adds a Pokémon to one of your teams. A Mega Evolution is added as its
 * regular form holding the Mega Stone. Nothing is shown for Pokémon that
 * aren't in Champions.
 */
export function AddToTeamButton({
  form,
  name,
  labelled = false,
}: {
  form: Form;
  name: string;
  /** Show the words "Add to team" next to the icon. */
  labelled?: boolean;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  if (!memberStartFor(form, data)) return null;
  const open = () => openAddToTeam(form, name);
  if (labelled) {
    return (
      <Button onClick={open}>
        <CirclePlus size={18} aria-hidden="true" />
        {t('teamEditor.addTo.button')}
      </Button>
    );
  }
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={t('teamEditor.addTo.buttonLabel', { name })}
      title={t('teamEditor.addTo.button')}
      onClick={open}
    >
      <CirclePlus size={20} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
