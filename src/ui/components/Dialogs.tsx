import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import styles from './Dialogs.module.css';

interface BaseDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** `wide`: for pickers with a long list. */
  size?: 'normal' | 'wide';
}

/** A native modal dialog: keyboard and screen-reader friendly, Esc closes it. */
export function Modal({ open, title, onClose, children, size = 'normal' }: BaseDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // A layout effect, so the dialog is already open when the content's own
  // effects run (for example to focus a search field).
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`${styles.dialog} ${size === 'wide' ? styles.wide : ''}`}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function PromptDialog({
  open,
  title,
  label,
  initialValue,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      {/* Mounted only while open, so the field starts from `initialValue` every time. */}
      {open && (
        <PromptForm
          label={label}
          initialValue={initialValue}
          confirmLabel={confirmLabel}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function PromptForm({
  label,
  initialValue,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  label: string;
  initialValue: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const inputId = useId();
  const trimmed = value.trim();
  return (
    <form
      method="dialog"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed) return;
        onConfirm(trimmed);
        onClose();
      }}
    >
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        value={value}
        maxLength={60}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
      />
      <div className={styles.actions}>
        <Button type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={!trimmed}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}

/** A dialog offering several actions, e.g. "Add to what's here" / "Replace everything". */
export function ChoiceDialog({
  open,
  title,
  message,
  choices,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  choices: { label: string; onChoose: () => void; variant?: 'primary' | 'danger' }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        {choices.map((choice) => (
          <Button
            key={choice.label}
            variant={choice.variant ?? 'secondary'}
            onClick={() => {
              choice.onChoose();
              onClose();
            }}
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
