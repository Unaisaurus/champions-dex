import { Copy, Download } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import { formatShowdownTeam } from '@/domain/showdown';
import type { Team } from '@/domain/team';
import { createTeamFile, teamFileName } from '@/storage/teamFile';
import { Button } from '@/ui/components/Button';
import { Modal } from '@/ui/components/Dialogs';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { downloadJson, downloadText } from '@/ui/download';
import { showToast } from '@/ui/toasts';
import { useShowdown } from './useShowdown';
import styles from './ImportExport.module.css';

type Format = 'showdown' | 'file';

/** Share a team: as Pokémon Showdown text to copy, or as a team file for this app. */
export function ExportDialog({ open, team, onClose }: { open: boolean; team: Team; onClose(): void }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t('teamEditor.export.title', { name: team.name })} onClose={onClose}>
      {open && <ExportBody team={team} onClose={onClose} />}
    </Modal>
  );
}

function ExportBody({ team, onClose }: { team: Team; onClose(): void }) {
  const { t } = useTranslation();
  const data = useGameData();
  const { names } = useShowdown();
  const [format, setFormat] = useState<Format>('showdown');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const textId = useId();
  const text = formatShowdownTeam(team.members, data, names);
  const baseName = teamFileName([team]).replace(/\.json$/, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('teamEditor.export.copied'));
    } catch {
      // No clipboard access (an old browser, or permission refused): select it for copying by hand.
      textRef.current?.select();
      showToast(t('teamEditor.export.copyByHand'));
    }
  };

  return (
    <div className={styles.body}>
      <SegmentedControl<Format>
        label={t('teamEditor.export.format')}
        labelHidden
        options={[
          { value: 'showdown', label: t('teamEditor.export.showdown') },
          { value: 'file', label: t('teamEditor.export.file') },
        ]}
        value={format}
        onChange={setFormat}
      />
      {format === 'showdown' ? (
        <>
          <p className={styles.hint}>{t('teamEditor.export.showdownHint')}</p>
          <label htmlFor={textId} className="visually-hidden">
            {t('teamEditor.export.showdown')}
          </label>
          <textarea
            ref={textRef}
            id={textId}
            className={styles.text}
            value={text}
            readOnly
            rows={12}
            spellCheck={false}
            onFocus={(event) => event.target.select()}
          />
          <div className={styles.actions}>
            <Button onClick={() => downloadText(`${baseName}.txt`, text)}>
              <Download size={17} aria-hidden="true" />
              {t('teamEditor.export.downloadText')}
            </Button>
            <Button variant="primary" onClick={() => void copy()}>
              <Copy size={17} aria-hidden="true" />
              {t('teamEditor.export.copy')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.hint}>{t('teamEditor.export.fileHint')}</p>
          <div className={styles.actions}>
            <Button onClick={onClose}>{t('common.close')}</Button>
            <Button
              variant="primary"
              onClick={() =>
                downloadJson(
                  teamFileName([team]),
                  createTeamFile([team], {
                    appVersion: __APP_VERSION__,
                    dataVersion: data.manifest.dataVersion,
                  }),
                )
              }
            >
              <Download size={17} aria-hidden="true" />
              {t('teamEditor.export.downloadFile')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
