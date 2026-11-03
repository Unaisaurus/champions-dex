import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toastStyles from '@/ui/components/Toasts.module.css';
import { showToast } from '@/ui/toasts';
import { usePwa } from './pwa';

/**
 * "A new version is ready · Reload", shown until you reload or close it, and a
 * one-time note when the app has been saved for offline use.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const updateReady = usePwa((state) => state.updateReady);
  const applyUpdate = usePwa((state) => state.applyUpdate);
  const justSavedOffline = usePwa((state) => state.justSavedOffline);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!justSavedOffline) return;
    usePwa.setState({ justSavedOffline: false });
    showToast(t('pwa.offlineReady'));
  }, [justSavedOffline, t]);

  if (!updateReady || dismissed) return null;
  return (
    <div className={toastStyles.toast}>
      <p className={toastStyles.message}>{t('pwa.updateReady')}</p>
      <button type="button" className={toastStyles.action} onClick={() => applyUpdate?.()}>
        {t('pwa.reload')}
      </button>
      <button
        type="button"
        className={toastStyles.close}
        aria-label={t('common.close')}
        onClick={() => setDismissed(true)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
