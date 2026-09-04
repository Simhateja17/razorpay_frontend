import assert from "node:assert/strict";
import test from "node:test";

import { parseMarkdown } from "../lib/markdown.ts";

test("parses assistant Markdown headings, bullets, and inline code", () => {
  const blocks = parseMarkdown(
    "Intro\n\n**See what's happening**\n- Sales snapshot\n- Check `stock`",
  );

  assert.deepEqual(blocks, [
    { type: "paragraph", lines: [[{ type: "text", text: "Intro" }]] },
    { type: "space" },
    { type: "paragraph", lines: [[{ type: "strong", text: "See what's happening" }]] },
    {
      type: "list",
      items: [
        [{ type: "text", text: "Sales snapshot" }],
        [
          { type: "text", text: "Check " },
          { type: "code", text: "stock" },
        ],
      ],
    },
  ]);
});

test("keeps unrecognised markup as inert text", () => {
  const [block] = parseMarkdown('<img src="x" onerror="alert(1)">');

  assert.deepEqual(block, {
    type: "paragraph",
    lines: [[{ type: "text", text: '<img src="x" onerror="alert(1)">' }]],
  });
});
