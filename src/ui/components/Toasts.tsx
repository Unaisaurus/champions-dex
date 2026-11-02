import { X } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { dismissToast, useToasts } from '@/ui/toasts';
import styles from './Toasts.module.css';

/** The messages from showToast(), announced politely to screen readers. */
export function Toasts() {
  const { t } = useTranslation();
  const toasts = useToasts((state) => state.toasts);
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          <p className={styles.message}>{toast.message}</p>
          {toast.action?.to && (
            <Link to={toast.action.to} className={styles.action} onClick={() => dismissToast(toast.id)}>
              {toast.action.label}
            </Link>
          )}
          {toast.action?.run && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action?.run?.();
                dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className={styles.close}
            aria-label={t('common.close')}
            onClick={() => dismissToast(toast.id)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
