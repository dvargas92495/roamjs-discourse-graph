import {
  getTreeByPageName,
  InputTextNode,
  TextNode,
  TreeNode,
} from "roam-client";
import { getSettingValueFromTree, toFlexRegex } from "roamjs-components";

let treeRef: { tree: TreeNode[] } = { tree: [] };

export const refreshConfigTree = () =>
  (treeRef.tree = getTreeByPageName("roam/js/discourse-graph"));

export const isFlagEnabled = (flag: string) =>
  treeRef.tree.some((t) => toFlexRegex(flag).test(t.text));

export const NODE_TITLE_REGEX = new RegExp(`^\\[\\[(\\w*)\\]\\] - `);

export const DEFAULT_NODE_VALUES: InputTextNode[] = [
  { text: "CLM", children: [{ text: "Claim" }, { text: "C" }] },
  { text: "QUE", children: [{ text: "Question" }, { text: "Q" }] },
  { text: "EVD", children: [{ text: "Evidence" }, { text: "E" }] },
  { text: "SOU", children: [{ text: "Source" }, { text: "S" }] },
  { text: "EXC", children: [{ text: "Excerpt" }, { text: "X" }] },
  { text: "AUT", children: [{ text: "Author" }, { text: "A" }] },
];
export const DEFAULT_RELATION_VALUES: InputTextNode[] = [
  {
    text: "Informs",
    children: [
      { text: "Source", children: [{ text: "EVD" }] },
      { text: "Destination", children: [{ text: "QUE" }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [{ text: "Is A", children: [{ text: "EVD" }] }],
              },
              {
                text: "Block",
                children: [
                  { text: "References", children: [{ text: "Page" }] },
                ],
              },
              {
                text: "Block",
                children: [
                  { text: "Is In Page", children: [{ text: "Parent Page" }] },
                ],
              },
              {
                text: "ParentPage",
                children: [{ text: "Is A", children: [{ text: "QUE" }] }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    text: "Supports",
    children: [
      { text: "Source", children: [{ text: "EVD", children: [] }] },
      { text: "Destination", children: [{ text: "CLM", children: [] }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [
                  { text: "Is A", children: [{ text: "EVD", children: [] }] },
                ],
              },
              {
                text: "Block",
                children: [
                  {
                    text: "References",
                    children: [{ text: "Page", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "References",
                    children: [{ text: "SPage", children: [] }],
                  },
                ],
              },
              {
                text: "SPage",
                children: [
                  {
                    text: "Has Title",
                    children: [{ text: "Supported By", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "Has Child",
                    children: [{ text: "Block", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "References",
                    children: [{ text: "ParentPage", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "Has Child",
                    children: [{ text: "SBlock", children: [] }],
                  },
                ],
              },
              {
                text: "ParentPage",
                children: [
                  { text: "Is A", children: [{ text: "CLM", children: [] }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    text: "Opposes",
    children: [
      { text: "Source", children: [{ text: "EVD", children: [] }] },
      { text: "Destination", children: [{ text: "CLM", children: [] }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [
                  { text: "Is A", children: [{ text: "EVD", children: [] }] },
                ],
              },
              {
                text: "Block",
                children: [
                  {
                    text: "References",
                    children: [{ text: "Page", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "References",
                    children: [{ text: "SPage", children: [] }],
                  },
                ],
              },
              {
                text: "SPage",
                children: [
                  {
                    text: "Has Title",
                    children: [{ text: "Opposed By", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "Has Child",
                    children: [{ text: "Block", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "References",
                    children: [{ text: "ParentPage", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "Has Child",
                    children: [{ text: "SBlock", children: [] }],
                  },
                ],
              },
              {
                text: "ParentPage",
                children: [
                  { text: "Is A", children: [{ text: "CLM", children: [] }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const getNodes = () =>
  (
    (
      treeRef.tree.find((t) => toFlexRegex("grammar").test(t.text))?.children ||
      []
    ).find((t) => toFlexRegex("nodes").test(t.text))?.children ||
    DEFAULT_NODE_VALUES
  ).map((n) => ({
    abbr: n.text,
    text: n.children[0]?.text || "",
    shortcut: n.children[1]?.text || "",
  }));

export const getRelations = () =>
  (
    (
      treeRef.tree.find((t) => toFlexRegex("grammar").test(t.text))?.children ||
      []
    ).find((t) => toFlexRegex("relations").test(t.text))?.children ||
    DEFAULT_RELATION_VALUES
  ).flatMap((r) => {
    const tree = (r?.children || []) as TextNode[];
    const data = {
      label: r.text,
      source: getSettingValueFromTree({
        tree,
        key: "Source",
      }),
      destination: getSettingValueFromTree({
        tree,
        key: "Destination",
      }),
    };
    return (
      tree.find((i) => toFlexRegex("if").test(i.text))?.children || []
    ).map((c) => ({
      ...data,
      triples: c.children.map((t) => [
        t.text,
        t.children[0]?.text,
        t.children[0]?.children?.[0]?.text,
      ]),
    }));
  });

const englishToDatalog: {
  [label: string]: (src: string, dest: string) => string;
} = {
  "is a": (src, dest) =>
    `[?${src} :block/refs ?${dest}-Page] [?${dest}-Page :node/title "${dest}"]`,
  references: (src, dest) => `[?${src} :block/refs ?${dest}]`,
  "is in page": (src, dest) => `[?${src} :block/page ?${dest}]`,
  "has title": (src, dest) => `[?${src} :node/title "${dest}"]`,
  "has child": (src, dest) => `[?${src} :block/children ?${dest}]`,
};

export const triplesToQuery = (t: string[][]): string =>
  t
    .map(([src, key, dest]) =>
      englishToDatalog[key.toLowerCase().trim()](src, dest)
    )
    .join(" ");
