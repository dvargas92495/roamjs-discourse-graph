import type {
  InputTextNode,
  RoamBasicNode,
  TextNode,
  DatalogClause,
} from "roamjs-components/types";
import createBlock from "roamjs-components/writes/createBlock";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import { render as referenceRender } from "./ReferenceContext";
import getSubTree from "roamjs-components/util/getSubTree";
import treeRef from "./utils/configTreeRef";

export type PanelProps = {
  uid: string;
  parentUid: string;
  title: string;
};
export type Panel = (props: PanelProps) => React.ReactElement;

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

export const getQueriesUid = () => {
  const uid = treeRef.tree.find((t) =>
    toFlexRegex("queries").test(t.text)
  )?.uid;
  if (uid) return uid;
  const newUid = window.roamAlphaAPI.util.generateUID();
  createBlock({
    node: { text: "queries", uid: newUid },
    parentUid: getPageUidByPageTitle("roam/js/discourse-graph"),
    order: 3,
  });
  return newUid;
};

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

export const ANY_REGEX = /Has Any Relation To/i;

export const DEFAULT_NODE_VALUES = [
  {
    type: "_CLM-node",
    format: "[[CLM]] - {content}",
    text: "Claim",
    shortcut: "C",
  },
  {
    type: "_QUE-node",
    format: "[[QUE]] - {content}",
    text: "Question",
    shortcut: "Q",
  },
  {
    type: "_EVD-node",
    format: "[[EVD]] - {content} - {Source}",
    text: "Evidence",
    shortcut: "E",
  },
  {
    type: "_SRC-node",
    format: "@{content}",
    text: "Source",
    shortcut: "S",
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
                children: [{ text: "is a", children: [{ text: "source" }] }],
              },
              {
                text: "Block",
                children: [
                  { text: "references", children: [{ text: "Page" }] },
                ],
              },
              {
                text: "Block",
                children: [
                  { text: "is in page", children: [{ text: "ParentPage" }] },
                ],
              },
              {
                text: "ParentPage",
                children: [
                  { text: "is a", children: [{ text: "destination" }] },
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
                    text: "is a",
                    children: [{ text: "source", children: [] }],
                  },
                ],
              },
              {
                text: "Block",
                children: [
                  {
                    text: "references",
                    children: [{ text: "Page", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "references",
                    children: [{ text: "SPage", children: [] }],
                  },
                ],
              },
              {
                text: "SPage",
                children: [
                  {
                    text: "has title",
                    children: [{ text: "SupportedBy", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "has child",
                    children: [{ text: "Block", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "references",
                    children: [{ text: "ParentPage", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "has child",
                    children: [{ text: "SBlock", children: [] }],
                  },
                ],
              },
              {
                text: "ParentPage",
                children: [
                  {
                    text: "is a",
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
                    text: "is a",
                    children: [{ text: "source", children: [] }],
                  },
                ],
              },
              {
                text: "Block",
                children: [
                  {
                    text: "references",
                    children: [{ text: "Page", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "references",
                    children: [{ text: "SPage", children: [] }],
                  },
                ],
              },
              {
                text: "SPage",
                children: [
                  {
                    text: "has title",
                    children: [{ text: "OpposedBy", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "has child",
                    children: [{ text: "Block", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "references",
                    children: [{ text: "ParentPage", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "has child",
                    children: [{ text: "SBlock", children: [] }],
                  },
                ],
              },
              {
                text: "ParentPage",
                children: [
                  {
                    text: "is a",
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
  if (!format) return false;
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
        .replace(/{[a-zA-Z]+}/g, "(.*?)")}$`,
      "s"
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
}): DatalogClause[] => {
  const [prefix, ...rest] = nodeFormat.split(/{[\w\d-]*}/g);
  const suffix = rest.slice(-1)[0] || "";
  const middle = rest.slice(0, rest.length - 1);
  return [
    ...((prefix
      ? [
          {
            type: "pred-expr",
            pred: "clojure.string/starts-with?",
            arguments: [
              { type: "variable", value: freeVar },
              { type: "constant", value: `"${prefix}"` },
            ],
          },
        ]
      : []) as DatalogClause[]),
    ...((suffix
      ? [
          {
            type: "pred-expr",
            pred: "clojure.string/ends-with?",
            arguments: [
              { type: "variable", value: freeVar },
              { type: "constant", value: `"${prefix}"` },
            ],
          },
        ]
      : []) as DatalogClause[]),
    ...(middle.map((m) => ({
      type: "pred-expr",
      pred: "clojure.string/includes?",
      arguments: [
        { type: "variable", value: freeVar },
        { type: "constant", value: `"${m}"` },
      ],
    })) as DatalogClause[]),
  ];
};

export const getNodes = () =>
  Object.entries(treeRef.nodes).map(([type, { text, children }]) => ({
    format: getSettingValueFromTree({ tree: children, key: "format" }),
    text,
    shortcut: getSettingValueFromTree({ tree: children, key: "shortcut" }),
    type,
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

export type Result = {
  text: string;
  uid: string;
  createdTime: number;
  editedTime: number;
  context?: string;
};

const resultCache: Record<
  string,
  ReturnType<typeof window.roamjs.extension.queryBuilder.fireQuery>
> = {};

export const getDiscourseContextResults = async (
  title: string,
  nodes = getNodes(),
  relations = getRelations(),
  useCache = false
) => {
  const nodeType = nodes.find(({ format }) =>
    matchNode({ format, title })
  )?.type;
  const nodeTextByType = Object.fromEntries(
    nodes.map(({ type, text }) => [type, text])
  );
  nodeTextByType["*"] = "Any";
  const rawResults = await Promise.all(
    relations
      .filter((r) => r.source === nodeType || r.source === "*")
      .map((r) => {
        const cacheKey = `${title}~${r.label}~${r.destination}`;
        const conditionUid = window.roamAlphaAPI.util.generateUID();
        const resultsPromise =
          useCache && resultCache[cacheKey]
            ? Promise.resolve(resultCache[cacheKey])
            : (resultCache[cacheKey] =
                window.roamjs.extension.queryBuilder.fireQuery({
                  returnNode: nodeTextByType[r.destination],
                  conditions: [
                    {
                      source: nodeTextByType[r.destination],
                      relation: r.complement,
                      target: title,
                      uid: conditionUid,
                      type: "clause",
                    },
                  ],
                  selections: [
                    {
                      uid: window.roamAlphaAPI.util.generateUID(),
                      label: "context",
                      text: `node:${conditionUid}-Context`,
                    },
                  ],
                }));
        return resultsPromise.then((results) => ({
          label: r.label,
          target: r.destination,
          complement: false,
          id: r.id,
          results,
        }));
      })
      .concat(
        relations
          .filter((r) => r.destination === nodeType || r.destination === "*")
          .map((r) => {
            const cacheKey = `${title}~${r.complement}~${r.source}`;
            const conditionUid = window.roamAlphaAPI.util.generateUID();
            const resultsPromise =
              useCache && resultCache[cacheKey]
                ? Promise.resolve(resultCache[cacheKey])
                : (resultCache[cacheKey] =
                    window.roamjs.extension.queryBuilder.fireQuery({
                      returnNode: nodeTextByType[r.source],
                      conditions: [
                        {
                          source: nodeTextByType[r.source],
                          relation: r.label,
                          target: title,
                          uid: conditionUid,
                          type: "clause",
                        },
                      ],
                      selections: [
                        {
                          uid: window.roamAlphaAPI.util.generateUID(),
                          label: "context",
                          text: `node:${conditionUid}-Context`,
                        },
                      ],
                    }));
            return resultsPromise.then((results) => ({
              label: r.complement,
              complement: true,
              target: r.source,
              id: r.id,
              results,
            }));
          })
      )
  ).catch((e) => {
    console.error(e);
    return [] as const;
  });
  const groupedResults = Object.fromEntries(
    rawResults.map((r) => [
      r.label,
      {} as Record<
        string,
        Partial<Result & { target: string; complement: boolean; id: string }>
      >,
    ])
  );
  rawResults.forEach((r) =>
    r.results
      .map(({ context, ["context-uid"]: contextUid, ...a }) => ({
        ...a,
        context: contextUid as string,
      }))
      .filter((a) => a.text !== title)
      .forEach(
        (res) =>
          (groupedResults[r.label][res.uid] = {
            ...res,
            target: nodeTextByType[r.target],
            complement: r.complement,
            id: r.id,
          })
      )
  );
  return Object.entries(groupedResults).map(([label, results]) => ({
    label,
    results,
  }));
};
