import type {
  InputTextNode,
  RoamBasicNode,
  TextNode,
  DatalogClause,
  DatalogAndClause,
} from "roamjs-components/types/native";
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
import refreshConfigTree from "./utils/refreshConfigTree";
import { Condition } from "roamjs-components/types/query-builder";
import compileDatalog from "roamjs-components/queries/compileDatalog";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { string } from "mathjs";

export type PanelProps = {
  uid: string;
  parentUid: string;
  title: string;
};
export type Panel = (props: PanelProps) => React.ReactElement;

export const getSubscribedBlocks = () =>
  treeRef.tree.find((s) => toFlexRegex("subscriptions").test(s.text))
    ?.children || [];

export const getQueriesUid = () => {
  const uid = treeRef.tree.find((t) =>
    toFlexRegex("queries").test(t.text)
  )?.uid;
  if (uid) return Promise.resolve(uid);

  return createBlock({
    node: { text: "queries" },
    parentUid: getPageUidByPageTitle("roam/js/discourse-graph"),
    order: 3,
  }).then((uid) => {
    refreshConfigTree();
    return uid;
  });
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

export const ANY_RELATION_REGEX = /Has Any Relation To/i;

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
  specification,
}: {
  format: string;
  title: string;
  specification: Condition[];
}) => {
  if (specification.length) {
    const where = specification
      .flatMap((c) =>
        window.roamjs.extension.queryBuilder.conditionToDatalog(c)
      )
      .map((c) => compileDatalog(c, 0));
    return !!window.roamAlphaAPI.data.fast.q(
      `[:find ?node :where [or-join [?node] [?node :node/title "${title}] [?node :block/string "${title}"]] ${where.join(
        " "
      )}]`
    ).length;
  }
  return getNodeFormatExpression(format).test(title);
};

export const getNodeFormatExpression = (format: string) =>
  new RegExp(
    `^${format
      .replace(/(\[|\]|\?|\.|\+)/g, "\\$1")
      .replace(/{[a-zA-Z]+}/g, "(.*?)")}$`,
    "s"
  );

export const isNodeTitle = (title: string) =>
  getNodes().some((n) => getNodeFormatExpression(n.format).test(title));

export const getNodeReferenceChildren = (title: string) => {
  const container = document.createElement("div");
  referenceRender({
    title,
    container,
  });
  return container;
};

export const replaceVariables = (
  replacements: (
    | { from: string; to: string }
    | { from: true; to: (v: string) => string }
  )[] = [],
  clauses: (DatalogClause | DatalogAndClause)[]
): void =>
  clauses.forEach((c) => {
    switch (c.type) {
      case "data-pattern":
      case "fn-expr":
      case "pred-expr":
      case "rule-expr":
        [...c.arguments]
          .filter((a) => a.type === "variable")
          .forEach((a) => {
            replacements.forEach((rep) => {
              if (a.value === rep.from) {
                a.value = rep.to;
              } else if (rep.from === true) {
                a.value = rep.to(a.value);
              }
            });
          });
        break;
      case "not-join-clause":
      case "or-join-clause":
        c.variables
          .filter((a) => a.type === "variable")
          .forEach((a) => {
            replacements.forEach((rep) => {
              if (a.value === rep.from) {
                a.value = rep.to;
              } else if (rep.from === true) {
                a.value = rep.to(a.value);
              }
            });
          });
      case "not-clause":
      case "or-clause":
      case "and-clause":
        replaceVariables(replacements, c.clauses);
        break;
      default:
        return;
    }
  });

export const nodeFormatToDatalog = ({
  nodeFormat = "",
  freeVar,
  nodeSpec = [],
}: {
  nodeFormat?: string;
  freeVar: string;
  nodeSpec?: Condition[];
}): DatalogClause[] => {
  if (nodeSpec.length) {
    const clauses = nodeSpec.flatMap(
      window.roamjs.extension.queryBuilder.conditionToDatalog
    );
    replaceVariables([{ from: "node", to: freeVar }], clauses);
    return clauses;
  }
  return window.roamjs.extension.queryBuilder.conditionToDatalog({
    source: freeVar,
    relation: "has title",
    target: `/${getNodeFormatExpression(nodeFormat).source}/`,
    type: "clause",
    uid: window.roamAlphaAPI.util.generateUID(),
  });
};

export const getNodes = () =>
  Object.entries(treeRef.nodes).map(([type, { text, children }]) => {
    const spec = getSubTree({
      tree: children,
      key: "specification",
    });
    const specTree = spec.children;
    return {
      format: getSettingValueFromTree({ tree: children, key: "format" }),
      text,
      shortcut: getSettingValueFromTree({ tree: children, key: "shortcut" }),
      type,
      specification:
        !!getSubTree({ tree: specTree, key: "enabled" }).uid &&
        window.roamjs.loaded.has("query-builder")
          ? window.roamjs.extension.queryBuilder.parseQuery(spec.uid).conditions
          : [],
    };
  });

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
) =>
  el ? Number((getComputedStyle(el)[field] || "0px").replace(/px$/, "")) : 0;

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
  Awaited<ReturnType<typeof window.roamjs.extension.queryBuilder.fireQuery>>
> = {};
const CACHE_TIMEOUT = 1000 * 60 * 5;

export const getDiscourseContextResults = async ({
  title,
  nodes = getNodes(),
  relations = getRelations(),
}: {
  title: string;
  nodes?: ReturnType<typeof getNodes>;
  relations?: ReturnType<typeof getRelations>;
}) => {
  const nodeType = nodes.find(({ format, specification }) =>
    matchNode({ format, title, specification })
  )?.type;
  const nodeTextByType = Object.fromEntries(
    nodes.map(({ type, text }) => [type, text])
  );
  nodeTextByType["*"] = "Any";
  const rawResults = await Promise.all(
    relations
      .flatMap((r) => {
        const queries = [];
        if (r.source === nodeType || r.source === "*") {
          queries.push({
            r,
            complement: false,
          });
        }
        if (r.destination === nodeType || r.destination === "*") {
          queries.push({
            r,
            complement: true,
          });
        }
        return queries;
      })
      .map(({ r, complement }) => {
        const target = complement ? r.source : r.destination;
        const label = complement ? r.complement : r.label;
        const returnNode = nodeTextByType[target];
        const cacheKey = `${title}~${label}~${target}`;
        const conditionUid = window.roamAlphaAPI.util.generateUID();
        const resultsPromise = resultCache[cacheKey]
          ? Promise.resolve(resultCache[cacheKey])
          : window.roamjs.extension.queryBuilder
              .fireQuery({
                returnNode,
                conditions: [
                  {
                    source: returnNode,
                    // NOTE! This MUST be the OPPOSITE of `label`
                    relation: complement ? r.label : r.complement,
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
              })
              .then((results) => {
                resultCache[cacheKey] = results;
                setTimeout(() => {
                  delete resultCache[cacheKey];
                }, CACHE_TIMEOUT);
                return results;
              });
        return resultsPromise.then((results) => ({
          label,
          complement,
          target,
          id: r.id,
          results,
        }));
      })
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
