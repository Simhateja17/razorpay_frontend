export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string };

export type MarkdownBlock =
  | { type: "paragraph"; lines: MarkdownInline[][] }
  | { type: "list"; items: MarkdownInline[][] }
  | { type: "quote"; lines: MarkdownInline[][] }
  | {
      type: "table";
      header: MarkdownInline[][] | null;
      rows: MarkdownInline[][][];
    }
  | { type: "hr" }
  | { type: "space" };

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
const BULLET = /^\s*[-•]\s+/;
const QUOTE = /^\s*>\s?/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const HORIZONTAL_RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

export function parseInline(text: string): MarkdownInline[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return { type: "strong", text: part.slice(2, -2) };
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return { type: "code", text: part.slice(1, -1) };
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return { type: "em", text: part.slice(1, -1) };
      }
      return { type: "text", text: part };
    });
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function tableBlock(rows: string[]): MarkdownBlock {
  const hasHeader = rows.length > 1 && TABLE_SEPARATOR.test(rows[1]);
  const header = hasHeader ? splitTableRow(rows[0]).map(parseInline) : null;
  const body = (hasHeader ? rows.slice(2) : rows).map((row) =>
    splitTableRow(row).map(parseInline),
  );
  return { type: "table", header, rows: body };
}

function isBlockStart(line: string): boolean {
  return (
    TABLE_ROW.test(line) ||
    BULLET.test(line) ||
    QUOTE.test(line) ||
    HORIZONTAL_RULE.test(line)
  );
}

/**
 * Parse the small, safe Markdown subset used in assistant replies.
 *
 * The output is an inert syntax tree. The React renderer deliberately creates
 * text nodes for all model-controlled content instead of injecting HTML.
 */
export function parseMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = text.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (TABLE_ROW.test(line)) {
      const rows: string[] = [];
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        rows.push(lines[index]);
        index += 1;
      }
      blocks.push(tableBlock(rows));
      continue;
    }

    if (BULLET.test(line)) {
      const items: MarkdownInline[][] = [];
      while (index < lines.length && BULLET.test(lines[index])) {
        items.push(parseInline(lines[index].replace(BULLET, "")));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (QUOTE.test(line)) {
      const quoteLines: MarkdownInline[][] = [];
      while (index < lines.length && QUOTE.test(lines[index])) {
        quoteLines.push(parseInline(lines[index].replace(QUOTE, "")));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    if (HORIZONTAL_RULE.test(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (line.trim() === "") {
      blocks.push({ type: "space" });
      index += 1;
      continue;
    }

    const paragraphLines: MarkdownInline[][] = [parseInline(line)];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index])) {
      paragraphLines.push(parseInline(lines[index]));
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraphLines });
  }

  return blocks;
}
