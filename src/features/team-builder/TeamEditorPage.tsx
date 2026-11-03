import { ArrowLeft, CloudAlert, CloudCheck, LoaderCircle, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Form } from '@/data/contracts';
import { validationContextFrom } from '@/data/gameData';
import { useGameData } from '@/data/useGameData';
import type { Team, TeamMember } from '@/domain/team';
import {
  addMember,
  changeMemberForm,
  insertMember,
  isTeamFull,
  moveMember,
  newMember,
  removeMember,
  updateMember,
} from '@/domain/teamEditing';
import { validateTeam, type ValidationIssue } from '@/domain/validation';
import { useGameText } from '@/i18n/useGameText';
import { activeMechanics } from '@/mechanics/registry';
import { modifySavedTeam, useTeamEditor, type TeamEditor } from '@/state/teamEditor';
import { useTeamActions } from '@/state/userData';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog, PromptDialog } from '@/ui/components/Dialogs';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { showToast } from '@/ui/toasts';
import { useAddressChoice } from '@/ui/useAddressChoice';
import { ExportDialog } from './ExportDialog';
import { IssueList } from './IssueList';
import { MemberEditor } from './MemberEditor';
import { PokemonPicker } from './PokemonPicker';
import { TeamMembersBar } from './TeamMembersBar';
import { TeamOverview } from './TeamOverview';
import styles from './TeamEditor.module.css';

type Picker = { kind: 'add' } | { kind: 'change'; member: TeamMember } | null;
type View = 'edit' | 'overview';
type Dialog = 'rename' | 'delete' | 'export' | null;

/** One team: its members in a row at the top and the editor of the selected member below. */
export function TeamEditorPage() {
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const editor = useTeamEditor(teamId);
  const { team } = editor;

  if (team === undefined) return <p className={styles.loading}>{t('common.loading')}</p>;
  if (team === null) {
    return (
      <div className={styles.missing}>
        <h1>{t('teamEditor.notFound')}</h1>
        <Link to="/teams">{t('teamEditor.allTeams')}</Link>
      </div>
    );
  }
  return <Editor team={team} editor={editor} />;
}

function Editor({ team, editor }: { team: Team; editor: TeamEditor }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const data = useGameData();
  const text = useGameText();
  const actions = useTeamActions();
  const [params, setParams] = useSearchParams();
  const [picker, setPicker] = useState<Picker>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const { update } = editor;

  const ctx = useMemo(() => validationContextFrom(data), [data]);
  const mechanics = useMemo(() => activeMechanics(data.rules), [data.rules]);
  const issues = useMemo(() => validateTeam(team, ctx, mechanics), [team, ctx, mechanics]);
  const issuesByMember = useMemo(() => {
    const map = new Map<string, ValidationIssue[]>();
    for (const issue of issues) {
      if (!issue.memberId) continue;
      map.set(issue.memberId, [...(map.get(issue.memberId) ?? []), issue]);
    }
    return map;
  }, [issues]);
  const teamIssues = issues.filter((issue) => !issue.memberId);

  // The selected member and the view (editing or overview) are kept in the
  // address, so reloading keeps them; see useAddressChoice.
  const [selectedId, chooseMember] = useAddressChoice(params.get('member'));
  const [view, chooseView] = useAddressChoice<View>(params.get('view') === 'overview' ? 'overview' : 'edit');
  const selected = team.members.find((member) => member.id === selectedId) ?? team.members[0] ?? null;
  const selectedIndex = selected ? team.members.indexOf(selected) : -1;
  /** Edits a member (showing the editor, if the overview was open). */
  const select = (memberId: string | null) => {
    chooseMember(memberId);
    chooseView('edit');
    setParams(memberId ? { member: memberId } : {}, { replace: true, preventScrollReset: true });
  };
  const setView = (next: View) => {
    chooseView(next);
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === 'overview') updated.set('view', 'overview');
        else updated.delete('view');
        return updated;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const nameOf = (member: TeamMember) => {
    const form = data.formsById.get(member.formId);
    return member.nickname.trim() || (form ? text.name('pokemon-names', form.speciesId) : member.formId);
  };

  const addPokemon = (form: Form) => {
    const member = newMember(form, data);
    setPicker(null);
    if (!member) return;
    update((current) => addMember(current, member, data.rules) ?? current);
    select(member.id);
  };

  const changePokemon = (member: TeamMember, form: Form) => {
    setPicker(null);
    const { member: changed, removedMoves } = changeMemberForm(member, form, data);
    if (changed === member) return;
    update((current) => updateMember(current, member.id, () => changed));
    if (removedMoves.length > 0) {
      const species = data.formsById.get(changed.formId)?.speciesId ?? changed.formId;
      showToast(
        t('teamEditor.member.movesRemoved', {
          count: removedMoves.length,
          name: changed.nickname.trim() || text.name('pokemon-names', species),
          moves: removedMoves.map((move) => text.name('move-names', move)).join(', '),
        }),
        {
          label: t('teamEditor.undo'),
          run: () =>
            void modifySavedTeam(team.id, (current) => updateMember(current, member.id, () => member)),
        },
      );
    }
  };

  const remove = (member: TeamMember) => {
    const index = team.members.indexOf(member);
    const neighbour = team.members[index + 1] ?? team.members[index - 1] ?? null;
    select(neighbour?.id ?? null);
    update((current) => removeMember(current, member.id));
    showToast(t('teamEditor.member.removed', { name: nameOf(member) }), {
      label: t('teamEditor.undo'),
      run: () => {
        void modifySavedTeam(team.id, (current) =>
          isTeamFull(current, data.rules) ? null : insertMember(current, member, index),
        );
      },
    });
  };

  return (
    <div className={styles.page}>
      <Link to="/teams" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" />
        {t('teamEditor.allTeams')}
      </Link>

      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h1 className={styles.teamName}>{team.name}</h1>
          <SaveStatus status={editor.status} />
        </div>
        <div className={styles.headerActions}>
          <Button variant="quiet" onClick={() => setDialog('export')}>
            <Share2 size={17} aria-hidden="true" />
            {t('teamEditor.export.button')}
          </Button>
          <Button variant="quiet" onClick={() => setDialog('rename')}>
            <Pencil size={17} aria-hidden="true" />
            {t('common.rename')}
          </Button>
          <Button variant="quiet" onClick={() => setDialog('delete')}>
            <Trash2 size={17} aria-hidden="true" />
            {t('teamEditor.deleteTeam')}
          </Button>
        </div>
      </header>

      <SegmentedControl<View>
        label={t('teamEditor.view.label')}
        labelHidden
        options={[
          { value: 'edit', label: t('teamEditor.view.edit') },
          { value: 'overview', label: t('teamEditor.view.overview') },
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'overview' ? (
        <TeamOverview
          team={team}
          issues={issues}
          onEdit={(memberId) => {
            select(memberId);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <>
          <TeamMembersBar
            team={team}
            selectedId={selected?.id ?? null}
            issuesByMember={issuesByMember}
            onSelect={select}
            onAdd={() => setPicker({ kind: 'add' })}
          />

          {teamIssues.length > 0 && (
            <section className={styles.teamIssues} aria-label={t('teamEditor.teamChecks')}>
              <IssueList issues={teamIssues} />
            </section>
          )}

          {selected ? (
            <MemberEditor
              key={selected.id}
              member={selected}
              index={selectedIndex}
              memberCount={team.members.length}
              issues={issuesByMember.get(selected.id) ?? []}
              onChange={(change) => update((current) => updateMember(current, selected.id, change))}
              onChangePokemon={() => setPicker({ kind: 'change', member: selected })}
              onMove={(offset) => update((current) => moveMember(current, selected.id, offset))}
              onRemove={() => remove(selected)}
            />
          ) : (
            <div className={styles.emptyTeam}>
              <p>{t('teamEditor.emptyTeam', { count: data.rules.teamSize })}</p>
              <Button variant="primary" onClick={() => setPicker({ kind: 'add' })}>
                <Plus size={18} aria-hidden="true" />
                {t('teamEditor.addPokemon')}
              </Button>
            </div>
          )}
        </>
      )}

      <PokemonPicker
        open={picker !== null}
        title={
          picker?.kind === 'change' ? t('teamEditor.picker.changeTitle') : t('teamEditor.picker.addTitle')
        }
        current={picker?.kind === 'change' ? picker.member.formId : null}
        onSelect={(form) => {
          if (picker?.kind === 'change') changePokemon(picker.member, form);
          else addPokemon(form);
        }}
        onClose={() => setPicker(null)}
      />
      <ExportDialog open={dialog === 'export'} team={team} onClose={() => setDialog(null)} />
      <PromptDialog
        open={dialog === 'rename'}
        title={t('teams.renameTitle')}
        label={t('teams.nameLabel')}
        initialValue={team.name}
        confirmLabel={t('common.save')}
        onConfirm={(name) => update((current) => (current.name === name ? current : { ...current, name }))}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('teamEditor.deleteTeam')}
        message={t('teams.deleteConfirm', { name: team.name })}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={() => {
          void actions.remove(team.id).then(() => navigate('/teams'));
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function SaveStatus({ status }: { status: TeamEditor['status'] }) {
  const { t } = useTranslation();
  const Icon = status === 'saved' ? CloudCheck : status === 'saving' ? LoaderCircle : CloudAlert;
  return (
    // Only a failure is announced: "Saving…" after every keystroke would be noise.
    <p
      className={`${styles.saveStatus} ${status === 'error' ? styles.saveError : ''}`}
      role={status === 'error' ? 'alert' : undefined}
    >
      <Icon size={17} aria-hidden="true" />
      {t(`teamEditor.save.${status}`)}
    </p>
  );
}
