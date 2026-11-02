/**
 * DATA UPDATER
 * ============
 * Rebuilds the app's game data (public/data/) from the sources:
 *
 *   npm run update-data            download the latest sources and rebuild
 *   npm run update-data -- --check build and check everything, but write nothing
 *   npm run update-data -- --offline  reuse the sources from the last run
 *
 * Every source is pinned to an exact revision and cached in data/sources/, so a
 * run can be repeated with identical results. Nothing is written unless every
 * check passes. Your teams are never touched: they live in your browser.
 */
import { join } from 'node:path';
import {
  CHANGELOG_FILE,
  CORE_FILES,
  ChangelogSchema,
  DATA_SCHEMA_VERSION,
  DexEntriesFileSchema,
  ManifestSchema,
  TextFileSchema,
  type ChangelogEntry,
  type CoreData,
  type EvolutionCondition,
  type FamilyNode,
  type Manifest,
} from '../../src/data/contracts';
import { checkIntegrity } from '../../src/data/integrity';
import { syncTranslations } from '../sync-translations';
import { buildAbilities, buildAlignments, buildItems, buildMoves, buildTypes } from './build/catalog';
import { buildContext } from './build/context';
import { buildDexEntries, TEXT_LANGUAGES } from './build/dexEntries';
import { buildFamilies } from './build/families';
import { buildChampionsForms, readMegaStones } from './build/forms';
import { buildLearnsets } from './build/learnsets';
import { matchForms } from './build/matching';
import { loadOverrides } from './build/overrides';
import { compareData, hasChanges, reportMarkdown } from './build/report';
import { buildSpecies, setLineGenerations } from './build/species';
import { buildSearchNames, buildText } from './build/text';
import { log } from './lib/log';
import { readJsonFile, OutputFolder } from './lib/output';
import { resolveRevision } from './lib/net';
import { OUTPUT_DIR, ROOT } from './lib/paths';
import { GAME_LANGUAGES, loadChampions } from './sources/champions';
import { SOURCES, type Revisions, type SourceKey } from './sources/config';
import { loadPokeApi } from './sources/pokeapi';
import { loadShowdown } from './sources/showdown';
import { IMAGE_GROUPS, loadSpriteIndex } from './sources/sprites';
import { loadSvText } from './sources/svText';
import { writeFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has('--check');
const OFFLINE = args.has('--offline') || process.env.OFFLINE === '1';
const CHANGELOG_LENGTH = 30;
const REPORT_FILE = join(ROOT, 'data', 'update-report.md');

async function resolveRevisions(previous: Manifest | null): Promise<Revisions> {
  const revisions = {} as Revisions;
  for (const [key, source] of Object.entries(SOURCES) as Array<[SourceKey, (typeof SOURCES)[SourceKey]]>) {
    const pinned = previous?.sources.find((s) => s.id === source.id)?.revision ?? null;
    if (OFFLINE) {
      if (!pinned) throw new Error(`--offline: no previous revision of ${source.name} to reuse`);
      revisions[key] = pinned;
    } else {
      revisions[key] = await resolveRevision(source);
    }
    log.info(
      `${source.name}: ${revisions[key].slice(0, 12)}${pinned && pinned !== revisions[key] ? ' (new)' : ''}`,
    );
  }
  return revisions;
}

function walkConditions(families: CoreData['families'], visit: (condition: EvolutionCondition) => void) {
  const walk = (node: FamilyNode) => {
    node.conditions.forEach(visit);
    node.children.forEach(walk);
  };
  families.forEach((family) => family.roots.forEach(walk));
}

function nextDataVersion(previous: Manifest | null, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  const last = previous?.dataVersion ?? '';
  if (!last.startsWith(day)) return day;
  const n = Number(last.slice(day.length + 1)) || 1;
  return `${day}.${n + 1}`;
}

async function main() {
  const started = Date.now();
  const previousManifest = (() => {
    const parsed = ManifestSchema.safeParse(readJsonFile(join(OUTPUT_DIR, 'manifest.json')));
    return parsed.success ? parsed.data : null;
  })();

  log.step('Source versions');
  const revisions = await resolveRevisions(
    previousManifest && !previousManifest.sample ? previousManifest : null,
  );

  log.step('Loading sources (cached in data/sources/)');
  const [champions, pokeapi, showdown, sv] = await Promise.all([
    loadChampions(revisions.champions),
    loadPokeApi(revisions.pokeapi),
    loadShowdown(revisions.showdown),
    loadSvText(revisions.svText),
  ]);
  const sprites = loadSpriteIndex(revisions.sprites);
  const overrides = loadOverrides();
  const ctx = buildContext({ champions, pokeapi, showdown, sv, sprites }, overrides);
  log.info(
    `Game data: ${champions.personal.length} Pokémon forms, ${champions.moves.length} moves, ${champions.items.length} items`,
  );

  log.step('Matching game forms to PokéAPI');
  const matched = matchForms(ctx);
  matched.problems.forEach((p) => log.warn(p));
  const stones = readMegaStones(ctx);
  stones.problems.forEach((p) => log.warn(p));
  const championsForms = buildChampionsForms(ctx, matched.matches, stones.stones);
  championsForms.problems.forEach((p) => log.warn(p));

  log.step('Evolution families');
  const familyResult = buildFamilies(ctx, championsForms.drafts);
  familyResult.problems.forEach((p) => log.warn(p));
  const drafts = [...championsForms.drafts, ...familyResult.reference];
  setLineGenerations(ctx, drafts);
  log.info(`${familyResult.families.length} families, ${familyResult.reference.length} reference forms`);

  // Things the evolution methods mention, which need names too.
  const referencedMoves = new Set<string>();
  const referencedItems = new Set<string>();
  const referencedRegions = new Set<string>();
  const referencedSpecies = new Set<string>();
  walkConditions(familyResult.families, (c) => {
    if (c.knownMove) referencedMoves.add(c.knownMove);
    if (c.usedMove) referencedMoves.add(c.usedMove);
    if (c.item) referencedItems.add(c.item);
    if (c.heldItem) referencedItems.add(c.heldItem);
    if (c.region) referencedRegions.add(c.region);
    if (c.partySpecies) referencedSpecies.add(c.partySpecies);
    if (c.tradeSpecies) referencedSpecies.add(c.tradeSpecies);
  });

  log.step('Moves, Abilities, items');
  const moves = buildMoves(ctx, referencedMoves);
  moves.problems.forEach((p) => log.warn(p));
  const abilities = buildAbilities(ctx, championsForms.drafts);
  const items = buildItems(ctx, championsForms.drafts, stones.stones, referencedItems);
  items.problems.forEach((p) => log.warn(p));

  log.step('Learnsets');
  const learnsets = buildLearnsets(ctx, drafts, familyResult.families, moves.idByNumber, moves.available);
  learnsets.problems.forEach((p) => log.warn(p));
  log.info(
    `${learnsets.stats.forms} learnsets, ${learnsets.stats.entries} moves, ${learnsets.stats.newInChampions} new in Champions`,
  );

  const speciesResult = buildSpecies(ctx, drafts, familyResult.familyOfSpecies);
  speciesResult.problems.forEach((p) => log.warn(p));

  log.step('Text and Pokédex entries');
  const championsSpecies = [...new Set(championsForms.drafts.map((d) => d.speciesNo))];
  const dex = buildDexEntries(ctx, championsSpecies);
  for (const language of TEXT_LANGUAGES) {
    if (dex.missing[language].length) {
      log.warn(`No ${language} Pokédex entries yet for: ${dex.missing[language].join(', ')}`);
    }
  }
  const speciesNos = new Set(drafts.map((d) => d.speciesNo));
  for (const id of referencedSpecies) {
    const record = ctx.speciesByIdentifier.get(id);
    if (record) speciesNos.add(record.id);
  }
  const text = buildText(ctx, {
    speciesNos,
    drafts,
    moves,
    abilities,
    items,
    regions: referencedRegions,
    versions: dex.versionsUsed,
  });
  const searchNames = buildSearchNames(ctx, drafts, text);

  // Hand-made corrections from data/overrides/forms.json.
  const formById = new Map(drafts.map((d) => [d.form.id, d.form]));
  for (const [id, patch] of Object.entries(overrides.forms.patches)) {
    const form = formById.get(id);
    if (!form) {
      log.warn(`forms.json: no form "${id}" to correct`);
      continue;
    }
    const { note: _note, ...fields } = patch;
    Object.assign(form, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)));
  }

  const core: CoreData = {
    rules: overrides.rules,
    species: speciesResult.species,
    forms: drafts.map((d) => d.form),
    families: familyResult.families,
    moves: moves.moves,
    abilities: abilities.abilities,
    items: items.items,
    learnsets: learnsets.learnsets,
    types: buildTypes(ctx),
    alignments: buildAlignments(ctx),
    searchNames,
    aliases: overrides.aliases,
  };

  log.step('Checking the result');
  const errors: string[] = [];
  for (const [key, { path, schema }] of Object.entries(CORE_FILES)) {
    const parsed = schema.safeParse(core[key as keyof CoreData]);
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 20))
        errors.push(`${path}: ${issue.path.join('.')}: ${issue.message}`);
    }
  }
  for (const problem of checkIntegrity(core)) errors.push(`${problem.file}: ${problem.message}`);
  // Everything an evolution method mentions must have a name in the data.
  const itemIds = new Set(core.items.map((i) => i.id));
  const moveIds = new Set(core.moves.map((m) => m.id));
  const typeIds = new Set(core.types.types);
  const alignmentIds = new Set(core.alignments.map((a) => a.id));
  walkConditions(core.families, (c) => {
    for (const item of [c.item, c.heldItem])
      if (item && !itemIds.has(item)) errors.push(`families.json: unknown item "${item}"`);
    for (const move of [c.knownMove, c.usedMove])
      if (move && !moveIds.has(move)) errors.push(`families.json: unknown move "${move}"`);
    for (const type of [c.knownMoveType, c.partyType])
      if (type && !typeIds.has(type)) errors.push(`families.json: unknown type "${type}"`);
    for (const nature of c.natures ?? [])
      if (!alignmentIds.has(nature)) errors.push(`families.json: unknown nature "${nature}"`);
  });
  for (const language of TEXT_LANGUAGES) {
    for (const [domain, file] of Object.entries(text[language])) {
      if (!TextFileSchema.safeParse(file).success)
        errors.push(`text/${language}/${domain}.json is malformed`);
    }
    if (!DexEntriesFileSchema.safeParse(dex.files[language]).success)
      errors.push(`text/${language}/dex-entries.json is malformed`);
    for (const [kind, ids] of [
      ['pokemon-names', core.species.map((s) => s.id)],
      ['move-names', core.moves.map((m) => m.id)],
      ['item-names', core.items.map((i) => i.id)],
      ['ability-names', core.abilities.map((a) => a.id)],
      ['type-names', core.types.types],
      ['alignment-names', core.alignments.map((a) => a.id)],
    ] as const) {
      const missing = ids.filter((id) => !text[language][kind][id]);
      if (missing.length)
        log.warn(
          `${language}/${kind}: no text for ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`,
        );
    }
  }
  if (errors.length) {
    console.error(`\n✖ ${errors.length} problem(s) found. Nothing was written.\n`);
    errors.slice(0, 100).forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
    return;
  }
  log.info('All checks passed.');

  // Assemble the output.
  const output = new OutputFolder();
  for (const [key, { path }] of Object.entries(CORE_FILES)) output.add(path, core[key as keyof CoreData]);
  for (const language of TEXT_LANGUAGES) {
    for (const [domain, file] of Object.entries(text[language]))
      output.add(`text/${language}/${domain}.json`, file);
    output.add(`text/${language}/dex-entries.json`, dex.files[language]);
  }
  const contentHash = output.hash();
  const unchanged = previousManifest?.contentHash === contentHash && !previousManifest.sample;

  const now = new Date();
  const manifest: Manifest = {
    format: 'champions-dex-data',
    schemaVersion: DATA_SCHEMA_VERSION,
    dataVersion:
      unchanged && previousManifest ? previousManifest.dataVersion : nextDataVersion(previousManifest, now),
    generatedAt:
      unchanged && previousManifest
        ? previousManifest.generatedAt
        : now.toISOString().replace(/\.\d+Z$/, 'Z'),
    sample: false,
    contentHash,
    game: { version: overrides.game.version, regulation: overrides.game.regulation },
    sources: (Object.entries(SOURCES) as Array<[SourceKey, (typeof SOURCES)[SourceKey]]>).map(
      ([key, source]) => ({
        id: source.id,
        name: source.name,
        url: `https://github.com/${source.repo}`,
        revision: revisions[key],
      }),
    ),
    textLanguages: [...TEXT_LANGUAGES],
    searchLanguages: [...new Set(Object.values(GAME_LANGUAGES))],
    images: {
      localDir: 'images',
      localExt: 'webp',
      mirroredGroups: [],
      remote: Object.fromEntries(
        Object.keys(IMAGE_GROUPS).map((group) => [group, sprites.remote[group] ?? { base: '', ext: 'png' }]),
      ),
    },
  };
  output.add('manifest.json', manifest);

  // What changed, compared with the data currently in public/data.
  let previousCore: CoreData | null = null;
  if (previousManifest && !previousManifest.sample) {
    const loaded: Partial<CoreData> = {};
    let complete = true;
    for (const [key, { path, schema }] of Object.entries(CORE_FILES)) {
      const parsed = schema.safeParse(readJsonFile(join(OUTPUT_DIR, path)));
      if (parsed.success) (loaded as Record<string, unknown>)[key] = parsed.data;
      else complete = false;
    }
    if (complete) previousCore = loaded as CoreData;
  }
  const changes = compareData(previousCore, core);
  const previousLog = ChangelogSchema.safeParse(readJsonFile(join(OUTPUT_DIR, CHANGELOG_FILE)));
  const changelog: ChangelogEntry[] = previousLog.success ? previousLog.data : [];
  if (!unchanged) {
    changelog.unshift({
      dataVersion: manifest.dataVersion,
      generatedAt: manifest.generatedAt,
      game: manifest.game,
      changes,
    });
  }
  output.add(CHANGELOG_FILE, changelog.slice(0, CHANGELOG_LENGTH));

  const counts = {
    'Pokédex entries in Champions': core.forms.filter(
      (f) => f.display === 'entry' && f.availability === 'champions',
    ).length,
    'Forms in Champions (incl. Megas and variants)': core.forms.filter((f) => f.availability === 'champions')
      .length,
    'Reference forms (family members outside Champions)': core.forms.filter(
      (f) => f.availability === 'reference',
    ).length,
    'Evolution families': core.families.length,
    'Moves available in Champions': core.moves.filter((m) => m.availableInChampions).length,
    'Moves changed from the main series': core.moves.filter((m) => m.mainSeries).length,
    Abilities: core.abilities.length,
    'Items in Champions': core.items.filter((i) => i.availableInChampions).length,
    'Learnset entries': learnsets.stats.entries,
    'Learnset entries new in Champions': learnsets.stats.newInChampions,
  };
  const report = reportMarkdown({
    manifest,
    changes,
    firstUpdate: !previousCore,
    counts,
    warnings: log.warnings(),
    notes: {
      "Learnsets that differ from PokéAPI's copy of the Champions learnsets":
        learnsets.stats.pokeapiDifferences,
      'Items Showdown treats differently': items.notes,
    },
  });

  if (CHECK_ONLY) {
    log.step('Check only: nothing written.');
    console.log(report);
    return;
  }
  if (unchanged) {
    log.step('No changes: the data is already up to date.');
    return;
  }
  output.commit(OUTPUT_DIR);
  writeFileSync(REPORT_FILE, report, 'utf8');
  log.step(`Wrote ${output.paths.length} files to public/data (data version ${manifest.dataVersion}).`);
  if (!previousCore) log.info('First real data set (replacing the sample).');
  else if (hasChanges(changes)) log.info('See data/update-report.md for what changed.');

  log.step('Translation files');
  syncTranslations();
  log.step(`Done in ${Math.round((Date.now() - started) / 1000)} s.`);
}

main().catch((error: unknown) => {
  console.error('\n✖ The data update failed. Nothing was written.\n');
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
