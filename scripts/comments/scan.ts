// Разбор на изходен файл до слети блокове коментар.
//
// Собствен разбор, а не TypeScript API: искаме РЕДОВЕ, не възли, а
// компилаторът дава коментара като диапазон в текста и пак трябва да се брои.

/** Слят блок коментар — съседни редове без код между тях. */
export interface CommentBlock {
  /** Първи ред на блока, броено от 1. */
  readonly start: number;
  /** Последен ред, включително. */
  readonly end: number;
  /** Дължина в редове, заедно с оградите. */
  readonly length: number;
  /** Редове с ТЕКСТ — по тях се мери, оградите не се броят. */
  readonly text: number;
  /** Стои ли преди първия ред код — челният блок на файла. */
  readonly header: boolean;
}

/** Ред само от огради или празен вътре в блока не носи текст. */
function carriesText(line: string): boolean {
  return !/^[\s/*]*$/.test(line);
}

interface State {
  inBlock: boolean;
  inTemplate: boolean;
  /** Последният значещ знак на реда — по него се различава израз от делене. */
  previous: string;
}

interface LineKind {
  readonly code: boolean;
  readonly comment: boolean;
}

/** Връща позицията след затварящия знак; при незатворен низ — края на реда. */
function skipQuoted(line: string, from: number, quote: string): number {
  let i = from + 1;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (line[i] === quote) return i + 1;
    i += 1;
  }
  return line.length;
}

/** Връща позицията след затварянето на блока; при незатворен — края на реда. */
function skipBlock(line: string, from: number, state: State): number {
  let i = from;
  while (i < line.length) {
    if (line[i] === '*' && line[i + 1] === '/') {
      state.inBlock = false;
      return i + 2;
    }
    i += 1;
  }
  return line.length;
}

/**
 * Регулярният израз започва там, където стойност не може да стои — иначе `/` е
 * делене. Без това `/[\s/*]/` се чете като начало на коментар.
 */
function startsRegex(previous: string): boolean {
  return !/[\w$)\]]/u.test(previous);
}

/** Вътре в клас `[…]` наклонената черта е обикновен знак, не край на израза. */
function skipRegex(line: string, from: number): number {
  let i = from + 1;
  let inClass = false;
  while (i < line.length) {
    const char = line[i];
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) return i + 1;
    i += 1;
  }
  return line.length;
}

/** Шаблонният низ преживява края на реда — затова се пази в състоянието. */
function skipTemplate(line: string, from: number, state: State): number {
  let i = from;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (line[i] === '`') {
      state.inTemplate = false;
      return i + 1;
    }
    i += 1;
  }
  return line.length;
}

/** Една стъпка: докъде стигнахме и какво видяхме по пътя. */
interface Step extends LineKind {
  readonly next: number;
  /** Остатъкът от реда е коментар до края — няма смисъл да се чете. */
  readonly done?: boolean;
}

/** Начало на коментар — двата вида. `null` значи „тук не започва такъв". */
function stepComment(line: string, from: number, state: State): Step | null {
  if (line[from] !== '/') return null;
  const next = line[from + 1];

  if (next === '/') {
    return { next: line.length, code: false, comment: true, done: true };
  }
  if (next !== '*') return null;

  state.inBlock = true;
  return { next: skipBlock(line, from + 2, state), code: false, comment: true };
}

/** Стъпка, започваща ИЗВЪН низ и коментар. */
function stepOutside(line: string, from: number, state: State): Step {
  const comment = stepComment(line, from, state);
  if (comment !== null) return comment;

  const char = line[from] ?? '';
  if (char === '`') {
    state.inTemplate = true;
    return { next: from + 1, code: true, comment: false };
  }
  if (char === "'" || char === '"') {
    return { next: skipQuoted(line, from, char), code: true, comment: false };
  }
  if (char === '/' && startsRegex(state.previous)) {
    return { next: skipRegex(line, from), code: true, comment: false };
  }
  const blank = char === ' ' || char === '\t';
  return { next: from + 1, code: !blank, comment: false };
}

function step(line: string, from: number, state: State): Step {
  if (state.inTemplate) {
    return {
      next: skipTemplate(line, from, state),
      code: true,
      comment: false,
    };
  }
  if (state.inBlock) {
    return { next: skipBlock(line, from, state), code: false, comment: true };
  }
  return stepOutside(line, from, state);
}

function classifyLine(line: string, state: State): LineKind {
  let code = false;
  let comment = false;
  let i = 0;

  while (i < line.length) {
    const seen = step(line, i, state);
    code ||= seen.code;
    comment ||= seen.comment;
    const consumed = line.slice(i, seen.next).trimEnd();
    if (consumed !== '') state.previous = consumed.slice(-1);
    i = seen.next;
    if (seen.done === true) break;
  }

  return { code, comment };
}

/** Слетите блокове коментар във файла, по ред на появяване. */
export function commentBlocks(source: string): CommentBlock[] {
  const state: State = { inBlock: false, inTemplate: false, previous: '' };
  const blocks: CommentBlock[] = [];
  const lines = source.split('\n');
  let start = 0;
  let text = 0;
  let seenCode = false;

  const close = (end: number): void => {
    if (start === 0) return;
    blocks.push({
      start,
      end,
      length: end - start + 1,
      text,
      header: !seenCode,
    });
    start = 0;
    text = 0;
  };

  lines.forEach((raw, index) => {
    const number = index + 1;
    const line = raw.replace(/\r$/, '');
    const kind = classifyLine(line, state);

    if (kind.comment && !kind.code) {
      if (start === 0) start = number;
      if (carriesText(line)) text += 1;
      return;
    }
    close(number - 1);
    if (kind.code) seenCode = true;
  });
  close(lines.length);

  return blocks;
}
