import { useTranslation } from 'react-i18next';
import { SectionTabs } from '@/ui/components/SectionTabs';

/** The Pokédex's four lists: Pokémon, moves, Abilities and items. */
export function DexSections() {
  const { t } = useTranslation();
  return (
    <SectionTabs
      label={t('dexSections.label')}
      tabs={[
        { to: '/', label: t('dexSections.pokemon'), end: true },
        { to: '/moves', label: t('dexSections.moves') },
        { to: '/abilities', label: t('dexSections.abilities') },
        { to: '/items', label: t('dexSections.items') },
      ]}
    />
  );
}
