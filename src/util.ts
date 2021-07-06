export const NODE_LABELS = [
  { text: "Claim", shortcut: "C", abbr: "CLM" },
  { text: "Question", shortcut: "Q", abbr: "QUE" },
  { text: "Evidence", shortcut: "E", abbr: "EVD" },
  { text: "Source", shortcut: "S", abbr: "SOU" },
  { text: "Excerpt", shortcut: "X", abbr: "EXC" },
  { text: "Author", shortcut: "A", abbr: "AUT" },
];

export const NODE_LABEL_ABBR_BY_TEXT = Object.fromEntries(
  NODE_LABELS.map(({ text, abbr }) => [text, abbr])
);

export const NODE_TITLE_REGEX = new RegExp(
  `^\\[\\[(${NODE_LABELS.map(({ abbr }) => abbr).join("|")})\\]\\] - `
);

export const NODE_ABBRS = new Set(NODE_LABELS.map(({ abbr }) => abbr));
