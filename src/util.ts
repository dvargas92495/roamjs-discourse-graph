import {
  createBlock,
  getBasicTreeByParentUid,
  getCurrentUserDisplayName,
  getCurrentUserUid,
  getDisplayNameByUid,
  getPageTitleByPageUid,
  getPageUidByPageTitle,
  getTreeByPageName,
  InputTextNode,
  RoamBasicNode,
  TextNode,
  TreeNode,
} from "roam-client";
import { getSettingValueFromTree, toFlexRegex } from "roamjs-components";

export type Panel = (props: {
  uid: string;
  parentUid: string;
}) => React.ReactElement;

let treeRef: { tree: RoamBasicNode[] } = { tree: [] };

export const refreshConfigTree = () =>
  (treeRef.tree = getBasicTreeByParentUid(
    getPageUidByPageTitle("roam/js/discourse-graph")
  ));

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

export const getQueriesUid = () =>
  treeRef.tree.find((t) => toFlexRegex("queries").test(t.text))?.uid ||
  createBlock({
    node: { text: "queries" },
    parentUid: getPageUidByPageTitle("roam/js/discourse-graph"),
    order: 3,
  });

export const isFlagEnabled = (flag: string) =>
  treeRef.tree.some((t) => toFlexRegex(flag).test(t.text));

export const NODE_TITLE_REGEX = new RegExp(`^\\[\\[(\\w*)\\]\\] - `);

export const DEFAULT_NODE_VALUES: InputTextNode[] = [
  {
    uid: "_CLM-node",
    text: "[[CLM]] - {content}",
    children: [{ text: "Claim" }, { text: "C" }],
  },
  {
    uid: "_QUE-node",
    text: "[[QUE]] - {content}",
    children: [{ text: "Question" }, { text: "Q" }],
  },
  {
    uid: "_EVD-node",
    text: "[[EVD]] - {content}",
    children: [{ text: "Evidence" }, { text: "E" }],
  },
  {
    uid: "_SOU-node",
    text: "[[SOU]] - {content}",
    children: [{ text: "Source" }, { text: "S" }],
  },
  {
    uid: "_EXC-node",
    text: "[[EXC]] - {content}",
    children: [{ text: "Excerpt" }, { text: "X" }],
  },
  {
    uid: "_AUT-node",
    text: "[[AUT]] - {content}",
    children: [{ text: "Author" }, { text: "A" }],
  },
];
export const DEFAULT_RELATION_VALUES: InputTextNode[] = [
  {
    text: "Informs",
    children: [
      { text: "Source", children: [{ text: "_EVD-node" }] },
      { text: "Destination", children: [{ text: "QUE" }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [{ text: "Is A", children: [{ text: "source" }] }],
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
                children: [
                  { text: "Is A", children: [{ text: "destination" }] },
                ],
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
      { text: "Source", children: [{ text: "_EVD-node", children: [] }] },
      { text: "Destination", children: [{ text: "_CLM-node", children: [] }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [
                  {
                    text: "Is A",
                    children: [{ text: "source", children: [] }],
                  },
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
                  {
                    text: "Is A",
                    children: [{ text: "destination", children: [] }],
                  },
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
      { text: "Source", children: [{ text: "_EVD-node", children: [] }] },
      { text: "Destination", children: [{ text: "_CLM-node", children: [] }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [
                  {
                    text: "Is A",
                    children: [{ text: "source", children: [] }],
                  },
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
                  {
                    text: "Is A",
                    children: [{ text: "destination", children: [] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const matchNode = ({
  format,
  title,
}: {
  format: string;
  title: string;
}) => {
  const [prefix = "", ...rest] = format.split(/{[\w\d-]*}/);
  const suffix = rest.slice(-1)[0] || "";
  const middle = rest.slice(0, rest.length - 1);
  return (
    title.startsWith(prefix) &&
    title.endsWith(suffix) &&
    middle.every((s) => title.includes(s))
  );
};

export const nodeFormatToDatalog = ({
  nodeFormat = "",
  freeVar,
}: {
  nodeFormat?: string;
  freeVar: string;
}) => {
  const [prefix, ...rest] = nodeFormat.split(/{[\w\d-]*}/g);
  const suffix = rest.slice(-1)[0] || "";
  const middle = rest.slice(0, rest.length - 1);
  const normalizedVar = freeVar.startsWith("?") ? freeVar : `?${freeVar}`;
  return `${
    prefix
      ? `[(clojure.string/starts-with? ${normalizedVar}  "${prefix}")]`
      : ""
  } ${
    suffix ? `[(clojure.string/ends-with? ${normalizedVar} "${suffix}")]` : ""
  } ${middle
    .map((m) => `[(clojure.string/includes? ${normalizedVar} "${m}")]`)
    .join(" ")}`;
};

export const getNodes = () =>
  (
    (
      treeRef.tree.find((t) => toFlexRegex("grammar").test(t.text))?.children ||
      []
    ).find((t) => toFlexRegex("nodes").test(t.text))?.children ||
    DEFAULT_NODE_VALUES
  ).map((n: InputTextNode) => ({
    format: n.text,
    text: n.children[0]?.text || "",
    shortcut: n.children[1]?.text || "",
    type: n.uid,
  }));

export const getRelations = () =>
  (
    (
      treeRef.tree.find((t) => toFlexRegex("grammar").test(t.text))?.children ||
      []
    ).find((t) => toFlexRegex("relations").test(t.text))?.children ||
    DEFAULT_RELATION_VALUES
  ).flatMap((r: InputTextNode, i: number) => {
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
      triples: c.children.map((t) => {
        const target = t.children[0]?.children?.[0]?.text || "";
        return [t.text, t.children[0]?.text, target];
      }),
    }));
  });

export const getRelationLabels = (relations = getRelations()) =>
  Array.from(new Set(relations.flatMap((r) => [r.label, r.complement]))).filter(
    (s) => !!s
  );

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

type DatalogTranslator = {
  [label: string]: (src: string, dest: string) => string;
};

export const englishToDatalog = (nodes = getNodes()): DatalogTranslator => {
  const formatByType = Object.fromEntries(nodes.map((n) => [n.type, n.format]));
  return {
    "is a": (src, dest) =>
      `[${freeVar(src)} :node/title ${freeVar(dest)}-Title] ${nodeFormatToDatalog({
        freeVar: `${freeVar(dest)}-Title`,
        nodeFormat: formatByType[dest],
      })}`,
    references: (src, dest) => `[${freeVar(src)} :block/refs ${freeVar(dest)}]`,
    "is in page": (src, dest) =>
      `[${freeVar(src)} :block/page ${freeVar(dest)}]`,
    "has title": (src, dest) => `[${freeVar(src)} :node/title "${dest}"]`,
    "has child": (src, dest) =>
      `[${freeVar(src)} :block/children ${freeVar(dest)}]`,
    "has parent": (src, dest) =>
      `[${freeVar(src)} :block/parents ${freeVar(dest)}]`,
    "with text": (src, dest) => `[${freeVar(src)} :block/string "${dest}"]`,
  };
};

export const triplesToQuery = (
  t: string[][],
  translator: DatalogTranslator
): string =>
  t
    .map(([src, key, dest]) => translator[key.toLowerCase().trim()](src, dest))
    .join(" ");

export const getUserIdentifier = () => {
  const uid = getCurrentUserUid();
  return getCurrentUserDisplayName() || getDisplayNameByUid(uid) || uid;
};

export const getPixelValue = (
  el: HTMLElement,
  field: "width" | "paddingLeft"
) => Number((getComputedStyle(el)[field] || "0px").replace(/px$/, ""));
