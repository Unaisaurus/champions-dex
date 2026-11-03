import { Flag } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import { LANGUAGES } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { Button } from '@/ui/components/Button';
import { Modal } from '@/ui/components/Dialogs';
import { issueUrl, REPORT_TOPICS, type ReportTopic } from './reportProblem';
import styles from './ReportProblem.module.css';

interface ReportProblemProps {
  /** What the report is about, e.g. the Pokémon's name. */
  subject: string;
  /** The choices offered for "What's it about?" (all of them by default). */
  topics?: readonly ReportTopic[];
  /** The button's look. */
  variant?: 'secondary' | 'quiet';
}

/** "Report a problem": a short form, then a GitHub issue with the details filled in. */
export function ReportProblemButton({
  subject,
  topics = REPORT_TOPICS,
  variant = 'quiet',
}: ReportProblemProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Flag size={16} aria-hidden="true" />
        {t('report.button')}
      </Button>
      <Modal open={open} title={t('report.title')} onClose={() => setOpen(false)}>
        {/* Mounted only while open, so every report starts empty. */}
        {open && <ReportForm subject={subject} topics={topics} onClose={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function ReportForm({
  subject,
  topics,
  onClose,
}: {
  subject: string;
  topics: readonly ReportTopic[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { manifest } = useGameData();
  const [language] = useLanguage();
  const [topic, setTopic] = useState<ReportTopic>(topics[0] ?? 'other');
  const [description, setDescription] = useState('');
  const topicId = useId();
  const descriptionId = useId();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <form
      method="dialog"
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const url = issueUrl({
          repository: __REPOSITORY__,
          topic,
          subject,
          address: window.location.href,
          description,
          data: {
            version: manifest.dataVersion,
            game: manifest.game.version,
            regulation: manifest.game.regulation,
          },
          language: LANGUAGES.find((entry) => entry.code === language)?.name ?? language,
          build: __APP_BUILD__,
        });
        window.open(url, '_blank', 'noopener,noreferrer');
        onClose();
      }}
    >
      <p className={styles.intro}>{t('report.intro')}</p>
      <div className={styles.field}>
        <label htmlFor={topicId}>{t('report.topic')}</label>
        <select id={topicId} value={topic} onChange={(event) => setTopic(event.target.value as ReportTopic)}>
          {topics.map((value) => (
            <option key={value} value={value}>
              {t(`report.topics.${value}`)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={descriptionId}>{t('report.description')}</label>
        <textarea
          id={descriptionId}
          rows={4}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <p className={styles.note}>{offline ? t('report.offline') : t('report.account')}</p>
      <div className={styles.actions}>
        <Button type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={offline}>
          {t('report.continue')}
        </Button>
      </div>
    </form>
  );
}
