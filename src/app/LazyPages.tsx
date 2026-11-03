/**
 * Pages loaded on first visit. The calculator brings Smogon's damage
 * calculator with it, so it's only downloaded when first opened (and then
 * kept for offline use like the rest of the app).
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const CalculatorPage = lazy(() =>
  import('@/features/calculator/CalculatorPage').then((module) => ({ default: module.CalculatorPage })),
);
const SpeedTiersPage = lazy(() =>
  import('@/features/calculator/SpeedTiersPage').then((module) => ({ default: module.SpeedTiersPage })),
);

function Later({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <Suspense fallback={<p role="status">{t('common.loading')}</p>}>{children}</Suspense>;
}

export function CalculatorRoute() {
  return (
    <Later>
      <CalculatorPage />
    </Later>
  );
}

export function SpeedTiersRoute() {
  return (
    <Later>
      <SpeedTiersPage />
    </Later>
  );
}
