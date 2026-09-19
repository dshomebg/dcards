#!/usr/bin/env node
/**
 * Двете бързи спирачки, ПРЕДИ пълната проверка.
 * Форматът се ОПРАВЯ (механичен е), коментарите СПИРАТ (искат преценка).
 * Защо: `docs/decisions.md` § „Спирачките се хващат преди пуска".
 */

import { execFileSync } from 'node:child_process';

const ROOT = new URL('../../', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const GLOB = '**/*.{ts,tsx,js,jsx,json,md,yml,yaml,css}';

/** Изход, който не спира нищо. */
function pass(message) {
  if (message !== undefined)
    process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

function run(file, args) {
  return execFileSync(file, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const input = JSON.parse(
  await new Promise((resolve) => {
    let raw = '';
    process.stdin.on('data', (chunk) => (raw += chunk));
    process.stdin.on('end', () => resolve(raw || '{}'));
  }),
);

const command = input?.tool_input?.command ?? '';
// Само пълната проверка. Всичко друго минава, без да плаща нищо.
if (!/pnpm\s+(run\s+)?verify/.test(command)) pass();

let formatted = [];
try {
  run('npx', ['prettier', '--list-different', `"${GLOB}"`]);
} catch (error) {
  formatted = String(error.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (formatted.length > 0) {
    try {
      run('npx', ['prettier', '--write', ...formatted.map((f) => `"${f}"`)]);
    } catch {
      formatted = [];
    }
  }
}

try {
  run('pnpm', ['comments:check']);
} catch (error) {
  const detail = `${String(error.stdout ?? '')}${String(error.stderr ?? '')}`
    .split('\n')
    .filter((line) => line.includes('таван') || line.includes('—'))
    .join('\n');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Спряно ПРЕДИ пълната проверка — тя щеше да падне на comments:check след четири минути.\n${detail}\n` +
          'Съкрати коментарите (таван 3 реда до код, 6 за челния блок) и пусни пак.',
      },
    }),
  );
  process.exit(0);
}

pass(
  formatted.length > 0
    ? `Форматирани преди проверката: ${formatted.join(', ')}`
    : undefined,
);
