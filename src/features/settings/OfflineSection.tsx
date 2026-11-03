import { Download, Smartphone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  artworkUrls,
  estimateArtworkBytes,
  isInstalled,
  promptInstall,
  saveAllArtwork,
  stopSavingArtwork,
  usePwa,
} from '@/app/pwa';
import { useGameData } from '@/data/useGameData';
import { localeOf } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { Button } from '@/ui/components/Button';
import styles from './SettingsPage.module.css';

/** Installing the app, offline status, and saving all artwork for offline use. */
export function OfflineSection() {
  const { t } = useTranslation();
  const [language] = useLanguage();
  const data = useGameData();
  const supported = usePwa((state) => state.supported);
  const offlineReady = usePwa((state) => state.offlineReady);
  const installPrompt = usePwa((state) => state.installPrompt);
  const artwork = usePwa((state) => state.artwork);
  const [shiny, setShiny] = useState(false);
  const urls = useMemo(() => artworkUrls(data, data.manifest, shiny), [data, shiny]);
  const number = new Intl.NumberFormat(localeOf(language));
  const megabytes = new Intl.NumberFormat(localeOf(language), {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 0,
  }).format(estimateArtworkBytes(urls) / 1_000_000);

  const status = !supported
    ? t('settings.offline.unsupported')
    : offlineReady
      ? t('settings.offline.ready')
      : t('settings.offline.preparing');

  return (
    <section className={styles.section} aria-labelledby="settings-offline">
      <h2 id="settings-offline">{t('settings.offline.title')}</h2>
      <p>{status}</p>

      {isInstalled() ? (
        <p className={styles.muted}>{t('settings.offline.installed')}</p>
      ) : installPrompt ? (
        <div className={styles.row}>
          <Button variant="primary" onClick={() => void promptInstall()}>
            <Smartphone size={18} aria-hidden="true" />
            {t('settings.offline.install')}
          </Button>
        </div>
      ) : (
        <p className={styles.muted}>{t('settings.offline.howToInstall')}</p>
      )}

      {supported && offlineReady && (
        <div className={styles.offlineArt}>
          <p>{t('settings.offline.artwork', { images: number.format(urls.length), size: megabytes })}</p>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={shiny}
              disabled={artwork.state === 'saving'}
              onChange={(e) => setShiny(e.target.checked)}
            />
            {t('settings.offline.includeShiny')}
          </label>
          {artwork.state === 'saving' ? (
            <div className={styles.progressRow}>
              <progress
                value={artwork.done}
                max={artwork.total}
                aria-label={t('settings.offline.saveArtwork')}
              />
              <span className={styles.muted}>
                {t('settings.offline.saving', {
                  done: number.format(artwork.done),
                  total: number.format(artwork.total),
                })}
              </span>
              <Button variant="quiet" onClick={stopSavingArtwork}>
                {t('settings.offline.stop')}
              </Button>
            </div>
          ) : (
            <div className={styles.row}>
              <Button onClick={() => void saveAllArtwork(urls)}>
                <Download size={17} aria-hidden="true" />
                {t('settings.offline.saveArtwork')}
              </Button>
            </div>
          )}
          {artwork.state === 'done' && (
            <p className={styles.status}>
              {artwork.failed === 0
                ? t('settings.offline.saved', { count: artwork.total })
                : t('settings.offline.savedSome', {
                    count: artwork.total - artwork.failed,
                    failed: artwork.failed,
                  })}
            </p>
          )}
          {artwork.state === 'stopped' && (
            <p className={styles.muted}>
              {t('settings.offline.stopped', {
                done: number.format(artwork.done),
                total: number.format(artwork.total),
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
