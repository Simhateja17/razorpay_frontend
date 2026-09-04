"use client";

import { Fragment, type ReactNode } from "react";
import {
  MarkdownBlock,
  MarkdownInline,
  parseMarkdown,
} from "@/lib/markdown";

function InlineContent({ nodes, keyPrefix }: { nodes: MarkdownInline[]; keyPrefix: string }) {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "strong") {
      return (
        <strong key={key} className="font-semibold">
          {node.text}
        </strong>
      );
    }
    if (node.type === "em") {
      return <em key={key}>{node.text}</em>;
    }
    if (node.type === "code") {
      return (
        <code key={key} className="rounded bg-surface-muted px-1 font-mono text-[13px]">
          {node.text}
        </code>
      );
    }
    return <Fragment key={key}>{node.text}</Fragment>;
  });
}

function Lines({ lines, keyPrefix }: { lines: MarkdownInline[][]; keyPrefix: string }) {
  return lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-${index}`}>
      {index > 0 && <br />}
      <InlineContent nodes={line} keyPrefix={`${keyPrefix}-${index}`} />
    </Fragment>
  ));
}

function Table({ block, index }: { block: Extract<MarkdownBlock, { type: "table" }>; index: number }) {
  return (
    <div className="my-1 overflow-x-auto rounded-lg border border-border-soft">
      <table className="w-full border-collapse text-left text-[13px]">
        {block.header && (
          <thead>
            <tr className="border-b border-border-soft bg-surface-muted">
              {block.header.map((cell, cellIndex) => (
                <th
                  key={`header-${cellIndex}`}
                  scope="col"
                  className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
                >
                  <InlineContent nodes={cell} keyPrefix={`table-${index}-header-${cellIndex}`} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="border-b border-border-soft last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={`cell-${rowIndex}-${cellIndex}`}
                  className={`px-2.5 py-1.5 text-ink ${cellIndex > 0 ? "text-right font-mono" : ""}`}
                >
                  <InlineContent nodes={cell} keyPrefix={`table-${index}-${rowIndex}-${cellIndex}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block, index }: { block: MarkdownBlock; index: number }): ReactNode {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="m-0" key={`paragraph-${index}`}>
          <Lines lines={block.lines} keyPrefix={`paragraph-${index}`} />
        </p>
      );
    case "list":
      return (
        <ul className="m-0 list-disc space-y-0.5 pl-5" key={`list-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`item-${itemIndex}`}>
              <InlineContent nodes={item} keyPrefix={`list-${index}-${itemIndex}`} />
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote
          className="m-0 border-l-2 border-border pl-2.5 italic text-ink-muted"
          key={`quote-${index}`}
        >
          <Lines lines={block.lines} keyPrefix={`quote-${index}`} />
        </blockquote>
      );
    case "table":
      return <Table block={block} index={index} />;
    case "hr":
      return <hr className="my-1 border-border-soft" key={`hr-${index}`} />;
    case "space":
      return <div aria-hidden="true" className="h-2" key={`space-${index}`} />;
  }
}

export default function Markdown({ text }: { text: string }) {
  return <>{parseMarkdown(text).map((block, index) => <Block block={block} index={index} key={index} />)}</>;
}
