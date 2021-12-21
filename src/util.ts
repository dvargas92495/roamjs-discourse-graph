import type {
  InputTextNode,
  RoamBasicNode,
  TextNode,
} from "roamjs-components/types";
import createBlock from "roamjs-components/writes/createBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import { render as referenceRender } from "./ReferenceContext";
import getSubTree from "roamjs-components/util/getSubTree";

export type PanelProps = {
  uid: string;
  parentUid: string;
  title: string;
};
export type Panel = (props: PanelProps) => React.ReactElement;

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

export const isFlagEnabled = (
  flag: string,
  inputTree?: RoamBasicNode[]
): boolean => {
  const flagParts = flag.split(".");
  const tree = inputTree || treeRef.tree;
  if (flagParts.length === 1)
    return tree.some((t) => toFlexRegex(flag).test(t.text));
  else
    return isFlagEnabled(
      flagParts.slice(1).join("."),
      getSubTree({ tree, key: flagParts[0] }).children
    );
};

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
    text: "[[EVD]] - {content} - {Source}",
    children: [{ text: "Evidence" }, { text: "E" }],
  },
  {
    uid: "_SRC-node",
    text: "@{content}",
    children: [{ text: "Source" }, { text: "S" }],
  },
];
export const DEFAULT_RELATION_VALUES: InputTextNode[] = [
  {
    text: "Informs",
    children: [
      { text: "Source", children: [{ text: "_EVD-node" }] },
      { text: "Destination", children: [{ text: "_QUE-node" }] },
      { text: "complement", children: [{ text: "Informed By" }] },
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
      { text: "complement", children: [{ text: "Supported By" }] },
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
      { text: "complement", children: [{ text: "Opposed By" }] },
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

export const isNodeTitle = (title: string) =>
  getNodes().some((n) =>
    new RegExp(
      `^${n.format
        .replace(/(\[|\]|\?|\.|\+)/g, "\\$1")
        .replace(/{[a-zA-Z]+}/g, "(.*?)")}$`
    ).test(title)
  );

export const getNodeReferenceChildren = (title: string) => {
  const container = document.createElement("div");
  referenceRender({
    title,
    container,
  });
  return container;
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
      triples: c.children
        .filter((t) => !/node positions/i.test(t.text))
        .map((t) => {
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
      `[${freeVar(src)} :node/title ${freeVar(
        dest
      )}-Title] ${nodeFormatToDatalog({
        freeVar: `${freeVar(dest)}-Title`,
        nodeFormat: formatByType[dest],
      })}`,
    references: (src, dest) => `[${freeVar(src)} :block/refs ${freeVar(dest)}]`,
    "is in page": (src, dest) =>
      `[${freeVar(src)} :block/page ${freeVar(dest)}]`,
    "has title": (src, dest) =>
      `[${freeVar(src)} :node/title "${normalizePageTitle(dest)}"]`,
    "has attribute": (src, dest) =>
      `[${freeVar(dest)}-Attribute :node/title "${dest}"] [${freeVar(
        dest
      )} :block/refs ${freeVar(dest)}-Attribute] [${freeVar(
        dest
      )} :block/parents ${freeVar(src)}]`,
    "has child": (src, dest) =>
      `[${freeVar(src)} :block/children ${freeVar(dest)}]`,
    "has ancestor": (src, dest) =>
      `[${freeVar(src)} :block/parents ${freeVar(dest)}]`,
    "has descendant": (src, dest) =>
      `[${freeVar(dest)} :block/parents ${freeVar(src)}]`,
    "with text": (src, dest) =>
      `(or [${freeVar(src)} :block/string ${freeVar(src)}-String] [${freeVar(
        src
      )} :node/title ${freeVar(
        src
      )}-String]) [(clojure.string/includes? ${freeVar(
        src
      )}-String "${normalizePageTitle(dest)}")]`,
  };
};

export const triplesToQuery = (
  t: string[][],
  translator: DatalogTranslator
): string =>
  t
    .map(
      ([src, key, dest]) =>
        translator[key.toLowerCase().trim()]?.(src, dest) || ""
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

export const getPageMetadata = (title: string) => {
  const results = window.roamAlphaAPI.q(
    `[:find (pull ?p [:create/time :block/uid]) (pull ?cu [:user/uid]) :where [?p :node/title "${normalizePageTitle(
      title
    )}"] [?p :create/user ?cu]]`
  ) as [[{ time: number; uid: string }, { uid: string }]];
  if (results.length) {
    const [[{ time: createdTime, uid: id }, { uid }]] = results;
    const displayName = getDisplayNameByUid(uid);
    const date = new Date(createdTime);
    return { displayName, date, id };
  }
  return {
    displayName: "Unknown",
    date: new Date(),
    id: "",
  };
};

export const getDiscourseContextResults = (
  title: string,
  nodes = getNodes(),
  relations = getRelations()
) => {
  const nodeType = nodes.find(({ format }) =>
    matchNode({ format, title })
  )?.type;
  try {
    const rawResults = [
      ...relations
        .filter((r) => r.source === nodeType)
        .map((r) => ({
          r,
          destinationTriple: r.triples.find(
            (t) => t[2] === "destination" || t[2] === r.destination
          ),
          sourceTriple: r.triples.find(
            (t) => t[2] === "source" || t[2] === r.source
          ),
        }))
        .filter(
          ({ sourceTriple, destinationTriple }) =>
            !!sourceTriple && !!destinationTriple
        )
        .map(({ r, destinationTriple, sourceTriple }) => {
          const lastPlaceholder = freeVar(destinationTriple[0]);
          return {
            label: r.label,
            results: Object.fromEntries(
              window.roamAlphaAPI
                .q(
                  `[:find (pull ${lastPlaceholder} [:block/uid :node/title]) :where ${triplesToQuery(
                    [
                      [sourceTriple[0], "Has Title", title],
                      [
                        destinationTriple[0],
                        destinationTriple[1],
                        r.destination,
                      ],
                      ...r.triples.filter(
                        (t) => t !== sourceTriple && t !== destinationTriple
                      ),
                    ],
                    englishToDatalog(nodes)
                  )}]`
                )
                .map(([{ uid, title }]: [Record<string, string>]) => [
                  uid,
                  title,
                ])
            ),
          };
        }),
      ...relations
        .filter((r) => r.destination === nodeType)
        .map((r) => ({
          r,
          sourceTriple: r.triples.find(
            (t) => t[2] === "source" || t[2] === r.source
          ),
          destinationTriple: r.triples.find(
            (t) => t[2] === "destination" || t[2] === r.destination
          ),
        }))
        .filter(
          ({ sourceTriple, destinationTriple }) =>
            !!sourceTriple && !!destinationTriple
        )
        .map(({ r, sourceTriple, destinationTriple }) => {
          const firstPlaceholder = freeVar(sourceTriple[0]);
          return {
            label: r.complement,
            results: Object.fromEntries(
              window.roamAlphaAPI
                .q(
                  `[:find (pull ${firstPlaceholder} [:block/uid :node/title]) :where ${triplesToQuery(
                    [
                      [destinationTriple[0], "Has Title", title],
                      [sourceTriple[0], sourceTriple[1], r.source],
                      ...r.triples.filter(
                        (t) => t !== destinationTriple && t !== sourceTriple
                      ),
                    ],
                    englishToDatalog(nodes)
                  )}]`
                )
                .map(([{ uid, title }]: [Record<string, string>]) => [
                  uid,
                  title,
                ])
            ),
          };
        }),
    ];
    const groupedResults = Object.fromEntries(
      rawResults.map((r) => [r.label, {} as Record<string, string>])
    );
    rawResults.forEach((r) =>
      Object.entries(r.results)
        .filter(([, v]) => v !== title)
        .forEach(([k, v]) => (groupedResults[r.label][k] = v))
    );
    return Object.entries(groupedResults).map(([label, results]) => ({
      label,
      results,
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
};
