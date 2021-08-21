import {
  createBlock,
  getCurrentUserDisplayName,
  getCurrentUserUid,
  getDisplayNameByUid,
  getPageUidByPageTitle,
  getTreeByPageName,
  InputTextNode,
  TextNode,
  TreeNode,
} from "roam-client";
import { getSettingValueFromTree, toFlexRegex } from "roamjs-components";

export type Panel = (props: {
  uid: string;
  parentUid: string;
}) => React.ReactElement;

let treeRef: { tree: TreeNode[] } = { tree: [] };

export const refreshConfigTree = () =>
  (treeRef.tree = getTreeByPageName("roam/js/discourse-graph"));

export const getSubscribedBlocks = () =>
  treeRef.tree.find((s) => toFlexRegex("subscriptions").test(s.text))
    ?.children || [];

export const getQueryUid = () =>
  treeRef.tree.find((t) => toFlexRegex("query").test(t.text))?.uid ||
  createBlock({
    node: { text: "query" },
    parentUid: getPageUidByPageTitle("roam/js/discourse-graph"),
    order: 3,
  });

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
                  { text: "Is In Page", children: [{ text: "ParentPage" }] },
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
                    children: [{ text: "SupportedBy", children: [] }],
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
                    children: [{ text: "OpposedBy", children: [] }],
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
  ).flatMap((r, i) => {
    const tree = (r?.children || []) as TextNode[];
    const data = {
      id: r.uid || `${r.text}-${i}`,
      label: r.text,
      source: getSettingValueFromTree({
        tree,
        key: "Source",
      }),
      destination: getSettingValueFromTree({
        tree,
        key: "Destination",
      }),
      complement: getSettingValueFromTree({
        tree,
        key: "Complement",
      }),
    };
    return (
      tree.find((i) => toFlexRegex("if").test(i.text))?.children || []
    ).map((c) => ({
      ...data,
      triples: c.children.map((t) => [
        t.text,
        t.children[0]?.text,
        t.children[0]?.children?.[0]?.text || "",
      ]),
    }));
  });

export const getRelationLabels = (relations = getRelations()) =>
  Array.from(new Set(relations.flatMap((r) => [r.label, r.complement])));

export const getRelationTriples = (relations = getRelations()) =>
  Array.from(
    new Set(
      relations.flatMap((r) => [
        JSON.stringify([r.label, r.source, r.destination]),
        JSON.stringify([r.complement, r.destination, r.source]),
      ])
    )
  )
    .map((s) => JSON.parse(s))
    .map(([relation, source, target]: string[]) => ({
      relation,
      source,
      target,
    }));

export const freeVar = (v: string) => `?${v.replace(/ /g, "")}`;

export const englishToDatalog: {
  [label: string]: (src: string, dest: string) => string;
} = {
  "is a": (src, dest) =>
    `[${freeVar(src)} :block/refs ${freeVar(dest)}-Page] [${freeVar(
      dest
    )}-Page :node/title "${dest}"]`,
  references: (src, dest) => `[${freeVar(src)} :block/refs ${freeVar(dest)}]`,
  "is in page": (src, dest) => `[${freeVar(src)} :block/page ${freeVar(dest)}]`,
  "has title": (src, dest) => `[${freeVar(src)} :node/title "${dest}"]`,
  "has child": (src, dest) =>
    `[${freeVar(src)} :block/children ${freeVar(dest)}]`,
  "has parent": (src, dest) =>
    `[${freeVar(src)} :block/parents ${freeVar(dest)}]`,
};

export const triplesToQuery = (t: string[][]): string =>
  t
    .map(([src, key, dest]) =>
      englishToDatalog[key.toLowerCase().trim()](src, dest)
    )
    .join(" ");

export const getUserIdentifier = () => {
  const uid = getCurrentUserUid();
  return getCurrentUserDisplayName() || getDisplayNameByUid(uid) || uid;
};

export const getPixelValue = (
  el: HTMLElement,
  field: "width" | "paddingLeft"
) => Number((getComputedStyle(el)[field] || "0px").replace(/px$/, ""));
