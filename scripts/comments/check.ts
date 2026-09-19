// Таван на дължината на коментарите — върху ПРОМЕНЕНИТЕ редове.
//
// Върху променените, не върху целия проект (наследено от pagagal): така старото
// изтича само, когато файлът се пипне по друг повод.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { argv, exit, stdout } from 'node:process';

import { commentBlocks } from './scan.js';

/** До код. Правилото на `CLAUDE.md` § 8: един до три реда ТЕКСТ. */
const INLINE_MAX = 3;

/** Челният блок на файла — той въвежда цял файл и заслужава повече. */
const HEADER_MAX = 6;

const EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const IGNORED = /^(?:drizzle|OLD|REFERENCE)\//;

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function sourceFiles(paths: string[]): string[] {
  return [...new Set(paths)]
    .map((line) => line.trim())
    .filter(
      (path) => path !== '' && EXTENSIONS.test(path) && !IGNORED.test(path),
    )
    .filter((path) => existsSync(path));
}

/** Файловете с промени спрямо подадената отправна точка, плюс новите. */
function changedFiles(ref: string): string[] {
  return sourceFiles([
    ...git(['diff', '--name-only', ref]).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
  ]);
}

/** Всички файлове — за еднократно минаване, не за всекидневната проверка. */
function allFiles(): string[] {
  return sourceFiles([
    ...git(['ls-files']).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
  ]);
}

/** Кои редове са ДОБАВЕНИ. Нов файл няма с какво да се мери — всичките му са. */
function addedLines(ref: string, file: string): Set<number> {
  const added = new Set<number>();
  let diff: string;
  try {
    diff = git(['diff', '-U0', ref, '--', file]);
  } catch {
    diff = '';
  }
  if (diff.trim() === '') {
    const total = readFileSync(file, 'utf8').split('\n').length;
    for (let line = 1; line <= total; line += 1) added.add(line);
    return added;
  }

  for (const hunk of diff.split('\n')) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(hunk);
    if (match === null) continue;
    const from = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let line = from; line < from + count; line += 1) added.add(line);
  }
  return added;
}

interface Finding {
  readonly file: string;
  readonly start: number;
  readonly length: number;
  /** Редове с текст — по тях се съди. */
  readonly text: number;
  readonly cap: number;
}

/** `null` за добавените редове значи „целият файл" — режимът `--all`. */
function findingsFor(file: string, added: Set<number> | null): Finding[] {
  const source = readFileSync(file, 'utf8');
  return commentBlocks(source)
    .map((block) => ({
      file,
      start: block.start,
      length: block.length,
      text: block.text,
      cap: block.header ? HEADER_MAX : INLINE_MAX,
    }))
    .filter((finding) => finding.text > finding.cap)
    .filter((finding) => added === null || touched(finding, added));
}

/** Само блок, в който наистина си писал — иначе чужд ред спъва твоята промяна. */
function touched(finding: Finding, added: Set<number>): boolean {
  for (
    let line = finding.start;
    line < finding.start + finding.length;
    line += 1
  ) {
    if (added.has(line)) return true;
  }
  return false;
}

const everything = argv[2] === '--all';
const ref = (everything ? argv[3] : argv[2]) ?? 'HEAD';
const files = everything ? allFiles() : changedFiles(ref);
const findings = files.flatMap((file) =>
  findingsFor(file, everything ? null : addedLines(ref, file)),
);

if (findings.length === 0) {
  stdout.write('Коментарите са в мярка.\n');
  exit(0);
}

stdout.write(
  `Твърде дълъг коментар на ${findings.length} места. Таванът е ${INLINE_MAX} реда ТЕКСТ до код ` +
    `и ${HEADER_MAX} за челния блок на файла (оградите и празните редове не се броят); ` +
    'по-дългата обосновка отива в docs/decisions.md, а в кода остава указател (CLAUDE.md § 8).\n\n',
);
for (const finding of findings) {
  stdout.write(
    `  ${finding.file}:${finding.start} — ${finding.text} реда текст (таван ${finding.cap})\n`,
  );
}
exit(1);
