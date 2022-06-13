// TODO LATER LIST
// - DEFAULT_[NODE|RELATIONS]_VALUES
// - Config, graph updates update cache

import type {
  DatalogAndClause,
  DatalogClause,
} from "roamjs-components/types/native";
import type { Result } from "roamjs-components/types/query-builder";
import { unpack } from "msgpackr/unpack";
import apiGet from "roamjs-components/util/apiGet";
import apiPut from "roamjs-components/util/apiPut";

const resetGraph = (): typeof graph => ({
  latest: 0,
  updater: 0,
  config: {
    nodes: [],
    relations: [],
    uid: "",
  },
  edges: {
    pagesByUid: {},
    pageUidByTitle: {},
    blocksPageByUid: {},
    blocksByUid: {},
    headingsByUid: {},
    childrenByUid: {},
    parentByUid: {},
    ancestorsByUid: {},
    descendantsByUid: {},
    referencesByUid: {},
    linkedReferencesByUid: {},
    createUserByUid: {},
    editUserByUid: {},
    createTimeByUid: {},
    editTimeByUid: {},
    userDisplayByUid: {},
    userUidByDisplay: {},
  },
});

const graph: {
  config: {
    nodes: {
      format: string;
      text: string;
      shortcut: string;
      type: string;
    }[];
    relations: {
      triples: string[][];
      id: string;
      label: string;
      source: string;
      destination: string;
      complement: string;
    }[];
    uid: string;
  };
  edges: {
    pagesByUid: Record<string, string>;
    pageUidByTitle: Record<string, string>;
    blocksPageByUid: Record<string, string>;
    blocksByUid: Record<string, string>;
    headingsByUid: Record<string, number>;
    childrenByUid: Record<string, string[]>;
    parentByUid: Record<string, string>;
    ancestorsByUid: Record<string, string[]>;
    descendantsByUid: Record<string, string[]>;
    referencesByUid: Record<string, string[]>;
    linkedReferencesByUid: Record<string, string[]>;
    createUserByUid: Record<string, string>;
    editUserByUid: Record<string, string>;
    createTimeByUid: Record<string, number>;
    editTimeByUid: Record<string, number>;
    userDisplayByUid: Record<string, string>;
    userUidByDisplay: Record<string, string>;
  };
  latest: number;
  updater: number;
} = resetGraph();

const accessBlocksDirectly = (graph: string) => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`v10_SLASH_dbs_SLASH_${graph}`);
    request.onerror = (e) => {
      reject((e.target as IDBRequest).error);
    };
    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest<IDBDatabase>).result);
    };
  })
    .then(
      (db) =>
        new Promise<[{ db_msgpack_array: Uint8Array }]>((resolve, reject) => {
          const request = db
            .transaction("snapshot")
            .objectStore("snapshot")
            .getAll();
          request.onerror = (e) => {
            reject((e.target as IDBRequest).error);
          };
          request.onsuccess = (event) => {
            resolve(
              (event.target as IDBRequest<[{ db_msgpack_array: Uint8Array }]>)
                .result
            );
          };
        })
    )
    .then((result) => {
      const serialized = unpack(result[0].db_msgpack_array) as {
        eavt: [number, number, unknown][];
        attrs: string[];
      };
      const objs = {} as Record<
        number,
        Record<string, string | number | number[] | bigint>
      >;
      const { eavt, attrs } = serialized;
      eavt.forEach((eavt) => {
        const [e, a, v] = eavt;
        const attr = attrs[a];
        const isArrayProp =
          attr === ":block/refs" || attr === ":block/children";
        if (objs[e]) {
          if (isArrayProp) {
            const arrProp = objs[e][attr] as number[];
            if (arrProp) {
              arrProp.push(v as number);
            } else {
              objs[e][attr] = [v as number];
            }
          } else {
            objs[e][attr] = v as string | number | bigint;
          }
        } else {
          if (isArrayProp) {
            objs[e] = { [attr]: [v as number] };
          } else {
            objs[e] = { [attr]: v as string | number | bigint };
          }
        }
      });
      return Object.entries(objs).map(([id, obj]) => ({
        id: Number(id),
        page: obj[":block/page"] as number,
        refs: obj[":block/refs"] as number[],
        title: obj[":node/title"] as string,
        string: obj[":block/string"] as string,
        uid: obj[":block/uid"] as string,
        children: obj[":block/children"] as number[],
        createdTime: Number(obj[":create/time"] as bigint),
        editedTime: Number(obj[":edit/time"] as bigint),
        displayName: obj[":user/display-name"] as string,
        createdBy: obj[":create/user"] as number,
        editedBy: obj[":edit/user"] as number,
        heading: obj[":block/heading"] as number,
      }));
    });
};

type Updates = (
  | { deleted_by_snapshot: true; source_t: number }
  | {
      deleted_by_snapshot: false;
      source_t: number;
      tx: string;
      tx_id: string;
      tx_meta: {
        "event-id": string;
        "event-name":
          | "add-comment"
          | "add-log-day"
          | "call-close-block"
          | "call-open-block"
          | "clean-db"
          | "collapse-window"
          | "create-block"
          | "create-ghost-block"
          | "create-new-or-unindent"
          | "delete-block"
          | "dnd-move-blocks"
          | "edit-record-seen"
          | "indent-block"
          | "insert-s-at"
          | "join-above-or-delete"
          | "move-block-down"
          | "move-block-up"
          | "open-sidebar"
          | "open-window"
          | "sidebar-main-zoom-fn"
          | "undo"
          | "unindent-block"
          | "unindent-blocks"
          | "update-block"
          | "user-focus-block";
        "force-child-evts-sync?": boolean;
        "tx-id": string;
        "tx-name":
          | "add-log-day"
          | "call-close-block"
          | "call-open-block"
          | "clean-db"
          | "create-block"
          | "create-ghost-block"
          | "delete-block-uids"
          | "dnd-move-blocks"
          | "edit-record-seen"
          | "indent-block"
          | "insert-new-child-at"
          | "join-above-or-delete"
          | "move-block-down"
          | "move-block-up"
          | "split-block-at-selection"
          | "undo"
          | "unindent-block"
          | "unindent-sibling-group"
          | "update-block-attrs"
          | "update-block-path-and-page"
          | "update-block-refs"
          | "update-block-string"
          | "update-user-settings";
      };
    }
)[];

type UpdateNode = {
  "~:block/uid"?: string;
  "~:block/string"?: string;
  "~:edit/time"?: number;
  "~:edit/user"?: UpdateNode;
  "~:create/time"?: number;
  "~:create/user"?: UpdateNode;
  "~:user/uid"?: string;
  "~:block/parents"?: UpdateNode[] | UpdateNode;
  "~:block/page"?: UpdateNode;
  "~:block/children"?: UpdateNode[] | UpdateNode;
  "~:db/retract"?: UpdateNode;
  "~:block/order"?: number;
  "~:db/add"?: UpdateNode;
  "~:block/refs"?: UpdateNode[];
};

const parseTxData = (s: string) => {
  const fields = Array.from(s.matchAll(/"~:[a-z\/-]+"/g)).map((k) =>
    k[0].slice(1, -1)
  );
  const parseUpdate = (args: unknown[]): UpdateNode =>
    Object.fromEntries(
      (args[0] === "^ " ? args.slice(1) : args)
        .map((arg, i, all) =>
          i < all.length - 1 ? [arg, all[i + 1]] : [arg, arg]
        )
        .filter((_, i) => i % 2 === 0)
        .map(([k, v]) => [
          typeof k === "string" && /^\^\d+$/.test(k)
            ? fields[Number(k.slice(1))]
            : k,
          Array.isArray(v)
            ? Array.isArray(v[0])
              ? v.map((vv) => parseUpdate(vv))
              : parseUpdate(v)
            : v,
        ])
    );

  const parseUpdates = (updates: unknown[]): UpdateNode[] =>
    updates[0] == "~#list"
      ? parseUpdates(updates[1] as unknown[])
      : updates.every((u) => Array.isArray(u))
      ? updates.map((u) => parseUpdate(u as unknown[]))
      : [];

  return parseUpdates(JSON.parse(s) as unknown[]);
};

const init = ({
  graph: _graph,
  id,
  authorization,
  cached,
}: {
  graph: string;
  id: string;
  authorization: string;
  cached: boolean;
}) => {
  clearTimeout(graph.updater);
  const save = () =>
    apiPut({
      path: "file",
      data: {
        extension: "discourse-graph",
        body: JSON.stringify(graph),
        path: `graph-cache/${id}.json`,
      },
      authorization,
    }).then(() => {
      // @ts-ignore
      graph.updater = global.setTimeout(updateWithLog, 10000) as number;
    });
  const updateWithLog = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(`v10_SLASH_dbs_SLASH_${_graph}`);
      request.onerror = (e) => {
        reject((e.target as IDBRequest).error);
      };
      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest<IDBDatabase>).result);
      };
    })
      .then(
        (db) =>
          new Promise<Updates>((resolve, reject) => {
            const request = db
              .transaction("confirmed-log")
              .objectStore("confirmed-log")
              .getAll(IDBKeyRange.lowerBound(graph.latest, true));
            request.onerror = (e) => {
              reject((e.target as IDBRequest).error);
            };
            request.onsuccess = (event) => {
              resolve((event.target as IDBRequest<Updates>).result);
            };
          })
      )
      .then((results) => {
        console.log("need to apply", results.length, "updates");
        // Using `some` to do forEach with `break`
        const failedToParse = results.some((result) => {
          // ts why is this not discriminated without the `=== true`??
          if (result.deleted_by_snapshot === true) {
            graph.latest = result.source_t;
            return;
          }
          const txName = result.tx_meta["tx-name"];
          try {
            if (txName === "update-block-string") {
              graph.latest = result.source_t;
              const [update] = parseTxData(result.tx);
              const uid = update["~:block/uid"];
              graph.edges.blocksByUid[uid] = update["~:block/string"];
              graph.edges.editTimeByUid[uid] = update["~:edit/time"];
              const user = update["~:edit/user"];
              graph.edges.editUserByUid[uid] = user["~:user/uid"];
            } else if (txName === "update-block-path-and-page") {
              const updates = parseTxData(result.tx);
              const add = updates.find((u) => u["~:db/add"]);
              const update = updates.find((u) => u["~:block/parents"]);

              const uid = update["~:block/uid"];
              const parentUid = (update["~:block/parents"] as UpdateNode)[
                "~:block/uid"
              ];
              graph.edges.parentByUid[uid] = parentUid;
              graph.edges.ancestorsByUid[uid] = (
                graph.edges.ancestorsByUid[uid] || []
              ).concat(parentUid);

              if (add) {
                graph.edges.blocksPageByUid[uid] =
                  add["~:block/page"]["~:block/uid"];
              }
            } else if (
              txName === "indent-block" ||
              txName === "unindent-block"
            ) {
              const updates = parseTxData(result.tx);
              const del = updates.find((u) => u["~:db/retract"]);
              const update = updates.find((u) => u["~:block/uid"]);
              const add = updates.find((u) => u["~:db/add"]);

              const parentUid = del["~:db/retract"]["~:block/uid"];
              const childUid = (del["~:block/children"] as UpdateNode)[
                "~:block/uid"
              ];
              graph.edges.childrenByUid[parentUid] = graph.edges.childrenByUid[
                parentUid
              ].filter((i) => childUid !== i);

              const newParentUid = update["~:block/uid"];
              graph.edges.childrenByUid[newParentUid] = (
                [] || graph.edges.childrenByUid[newParentUid]
              )
                .slice(0, update["~:block/order"])
                .concat([childUid])
                .concat(
                  ([] || graph.edges.childrenByUid[newParentUid]).slice(
                    update["~:block/order"]
                  )
                );
              if (add) {
                // I think this should already be covered, might be coming up on drag
              }
            } else if (txName === "insert-new-child-at") {
              const updates = parseTxData(result.tx);
              const insert = updates.find((u) => !!u["~:block/uid"]);
              const parentUid = insert["~:block/uid"];
              const blocks = insert["~:block/children"] as UpdateNode[];
              blocks.forEach((block) => {
                const uid = block["~:block/uid"];
                graph.edges.editTimeByUid[uid] = block["~:edit/time"];
                graph.edges.editUserByUid[uid] =
                  block["~:edit/user"]["~:user/uid"];
                graph.edges.createTimeByUid[uid] = block["~:create/time"];
                graph.edges.createUserByUid[uid] =
                  block["~:create/user"]["~:user/uid"];
                graph.edges.blocksByUid[uid] = block["~:block/string"];
                graph.edges.headingsByUid[uid] = 0;
                // TODO :block/open
                graph.edges.childrenByUid[parentUid] =
                  graph.edges.childrenByUid[parentUid] || [];
                graph.edges.childrenByUid[parentUid].splice(
                  block["~:block/order"],
                  0,
                  uid
                );
              });
            } else if (txName === "update-block-refs") {
              const updates = parseTxData(result.tx);
              const update = updates.find((u) => u["~:block/uid"]);
              const uid = update["~:block/uid"];
              const refs = update["~:block/refs"].map((r) => r["~:block/uid"]);
              graph.edges.referencesByUid[uid] = (
                graph.edges.referencesByUid[uid] || []
              ).concat(refs);
              refs.forEach((refId) => {
                if (graph.edges.linkedReferencesByUid[refId]) {
                  graph.edges.linkedReferencesByUid[refId].push(uid);
                } else {
                  graph.edges.linkedReferencesByUid[refId] = [uid];
                }
              });
            } else if (txName === "update-user-settings") {
              // ignore
            } else if (txName === "call-open-block") {
              // ignore
            } else if (txName === "edit-record-seen") {
              // ignore
            } else {
              console.warn(
                "didnt know how to parse event",
                result.tx_meta["event-name"],
                "tx",
                result.tx_meta["tx-name"],
                "data",
                JSON.parse(result.tx)
              );
              return true;
            }

            graph.latest = result.source_t;
          } catch (e) {
            console.warn(
              "didnt know how to parse event",
              txName,
              "data",
              JSON.parse(result.tx)
            );
            console.error(e);
            return true;
          }
        });
        if (!failedToParse) console.log("Processed all updates!");
        return save();
      });
  };
  if (cached) {
    return apiGet<typeof graph>({
      path: `file`,
      data: {
        extension: "discourse-graph",
        path: `graph-cache/${id}.json`,
      },
      authorization,
    }).then((r) => {
      const { config, edges, latest } = r;
      graph.config = config;
      graph.edges = edges;
      graph.latest = latest;
      postMessage({ method: "init" });
      // @ts-ignore
      graph.updater = global.setTimeout(updateWithLog, 10000) as number;
    });
  } else {
    // TODO: only on update
    const { config, edges, latest } = resetGraph();
    graph.config = config;
    graph.edges = edges;
    graph.latest = latest;
  }
  return accessBlocksDirectly(_graph)
    .then((blocks) => {
      const getUid = Object.fromEntries(
        blocks.map((b) => [b.id, b.uid])
      ) as Record<number, string>;
      blocks.forEach(
        ({
          page,
          refs,
          title,
          string,
          children,
          uid,
          heading,
          createdTime,
          editedTime,
          displayName,
          createdBy,
          editedBy,
        }) => {
          graph.edges.createUserByUid[uid] = getUid[createdBy];
          graph.edges.editUserByUid[uid] = getUid[editedBy];
          graph.edges.createTimeByUid[uid] = createdTime;
          graph.edges.editTimeByUid[uid] = editedTime;
          if (!title && !string) {
            graph.edges.userDisplayByUid[uid] = displayName;
            graph.edges.userUidByDisplay[displayName] = uid;
          } else if (!page && title) {
            graph.edges.pagesByUid[uid] = title;
            graph.edges.pageUidByTitle[title] = uid;
            if (title === "roam/js/discourse-graph") {
              graph.config.uid = uid;
            }
          } else if (page) {
            graph.edges.blocksByUid[uid] = string;
            graph.edges.headingsByUid[uid] = heading || 0;
            graph.edges.blocksPageByUid[uid] = getUid[page];
          }
          if (refs) {
            refs.forEach((refId) => {
              if (graph.edges.linkedReferencesByUid[refId]) {
                graph.edges.linkedReferencesByUid[refId].push(uid);
              } else {
                graph.edges.linkedReferencesByUid[refId] = [uid];
              }
            });
            graph.edges.referencesByUid[uid] = refs.map((id) => getUid[id]);
          }
          if (children) {
            graph.edges.childrenByUid[uid] = children.map((id) => getUid[id]);
            children.forEach((c) => (graph.edges.parentByUid[c] = uid));
          }
        }
      );

      const findChild = (text: string) => (c: string) =>
        new RegExp(`^\\s*${text}\\s*$`, "i").test(graph.edges.blocksByUid[c]);
      const getSettingValueFromTree = ({
        tree,
        key,
      }: {
        tree: string[];
        key: string;
      }) =>
        graph.edges.blocksByUid[
          graph.edges.childrenByUid[tree.find(findChild(key))]?.[0]
        ] || "";
      const grammarChildren =
        graph.edges.childrenByUid[
          (graph.edges.childrenByUid[graph.config.uid] || []).find(
            findChild("grammar")
          )
        ] || [];

      graph.config.nodes = Object.entries(graph.edges.pagesByUid)
        .filter(([, title]) => title.startsWith("discourse-graph/nodes/"))
        .map(([_uid, text]) => {
          const nchildren = graph.edges.childrenByUid[_uid] || [];
          return {
            format:
              graph.edges.blocksByUid[
                (graph.edges.childrenByUid[
                  nchildren.find(findChild("format"))
                ] || [])[0]
              ],
            type: _uid,
            text,
            shortcut:
              graph.edges.blocksByUid[
                (graph.edges.childrenByUid[
                  nchildren.find(findChild("shortcut"))
                ] || [])[0]
              ],
          };
        });
      graph.config.relations = (
        graph.edges.childrenByUid[
          grammarChildren.find(findChild("relations"))
        ] || ([] as const)
      ).flatMap((r, i) => {
        const tree: string[] = graph.edges.childrenByUid[r] || [];
        const data = {
          id: r || `${graph.edges.blocksByUid[r]}-${i}`,
          label: graph.edges.blocksByUid[r],
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
        return graph.edges.childrenByUid[tree.find(findChild("if"))].map(
          (c) => {
            return {
              ...data,
              triples: (graph.edges.childrenByUid[c] || [])
                .filter(
                  (t) => !/node positions/i.test(graph.edges.blocksByUid[t])
                )
                .map((t) => {
                  const firstChild = (graph.edges.childrenByUid[t] || [])?.[0];
                  const lastChild = (graph.edges.childrenByUid[firstChild] ||
                    [])?.[0];
                  return [
                    graph.edges.blocksByUid[t] || "",
                    graph.edges.blocksByUid[firstChild] || "",
                    graph.edges.blocksByUid[lastChild] || "",
                  ];
                }),
            };
          }
        );
      });

      const allPages = new Set(Object.keys(graph.edges.pagesByUid));
      const allBlocks = new Set(Object.keys(graph.edges.blocksByUid));

      const getDescendants = (uid: string): string[] => {
        const des = (graph.edges.childrenByUid[uid] || []).flatMap((i) => [
          i,
          ...getDescendants(i),
        ]);
        graph.edges.descendantsByUid[uid] = des;
        return des;
      };
      allPages.forEach(getDescendants);

      allBlocks.forEach((uid) => {
        graph.edges.ancestorsByUid[uid] = [];
        for (
          let i = graph.edges.parentByUid[uid];
          !!i;
          i = graph.edges.parentByUid[i]
        ) {
          graph.edges.ancestorsByUid[uid].push(i);
        }
      });

      return save().then(() => {
        postMessage({ method: "init", id });
      });
    })
    .catch((e) => {
      postMessage({ method: "init", error: e.message });
    });
};

const matchNode = ({
  format,
  title = "",
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

const overview = () => {
  const edges: unknown[] = [];
  /*Object.entries(graph.discourseRelations).flatMap(
    ([source, relations]) =>
      relations
        .filter((r) => !r.complement)
        .flatMap((info) =>
          info.results
            .filter((target) => target.id !== Number(source))
            .map((target) => ({
              source: source,
              label: info.label,
              target: target.id.toString(),
              id: info.id,
            }))
        )
  );*/
  const nodes = Object.entries(graph.edges.pagesByUid)
    .map(([id, title]) => ({
      id,
      label: title,
      filterId: graph.config.nodes.find(({ format }) =>
        matchNode({ format, title })
      )?.type,
    }))
    .filter(({ filterId }) => !!filterId);
  postMessage({
    method: "overview",
    elements: {
      nodes,
      edges,
    },
    config: graph.config,
  });
};

export type QueryArgs = {
  where: DatalogClause[];
  pull: {
    _var: string;
    field: string;
    label: string;
  }[];
};

type NodeAssignment = { uid: string };
type Assignment = Record<string, NodeAssignment | string | number | RegExp>;
const isNode = (v: Assignment[string]): v is NodeAssignment =>
  typeof v === "object" && !(v instanceof RegExp);

const getAssignments = (
  where: (DatalogClause | DatalogAndClause)[],
  initialVars = [] as string[]
) => {
  return where.reduce(
    (programs, clause, index) => {
      if (programs.assignments.size === 0 && index > 0) return programs;
      const reconcile = (matches: Assignment[], vars: string[]) => {
        vars.forEach((v) => programs.vars.add(v));
        programs.assignments = new Set(
          Array.from(
            new Set(
              (programs.assignments.size === 0 && index === 0
                ? matches
                : Array.from(programs.assignments).flatMap((dict) =>
                    matches.map((dic) => ({
                      ...dict,
                      ...dic,
                    }))
                  )
              ).map((a) =>
                // remove duplicate assignments
                JSON.stringify(
                  Object.entries(a).sort(([ka], [kb]) => ka.localeCompare(kb))
                )
              )
            )
          ).map((s) => Object.fromEntries(JSON.parse(s)))
        );
      };
      if (clause.type === "data-pattern") {
        const [source, relation, target] = clause.arguments;
        if (source.type !== "variable") {
          console.warn("Expected source type to be variable");
          programs.assignments = new Set();
          return programs;
        }
        const v = source.value.toLowerCase();
        if (relation.type !== "constant") {
          console.warn("Expected relation type to be constant");
          programs.assignments = new Set();
          return programs;
        }
        const rel = relation.value.toLowerCase();
        const targetString = target.value.replace(/^"/, "").replace(/"$/, "");
        const targetVar = target.value.toLowerCase();
        if (programs.vars.has(v)) {
          const newAssignments = Array.from(programs.assignments).flatMap(
            (dict) => {
              const sourceEntry = dict[v];
              if (!isNode(sourceEntry)) {
                console.warn("Expected the source variable to map to a node");
                return [];
              }
              const sourceId = sourceEntry.uid;
              if (rel === ":block/refs") {
                if (target.type !== "variable") {
                  console.warn(
                    "Expected target for :block/refs to be a variable"
                  );
                  return [];
                }
                const targetEntry = dict[targetVar];
                const refs = (
                  isNode(targetEntry)
                    ? [targetEntry.uid]
                    : graph.edges.referencesByUid[sourceId] || []
                ).map((ref) => ({
                  ...dict,
                  [targetVar]: { uid: ref },
                }));
                if (refs.length) programs.vars.add(targetVar);
                return refs;
              } else if (rel === ":block/page") {
                if (target.type !== "variable") {
                  console.warn(
                    "Expected target for :block/page to be a variable"
                  );
                  return [];
                }
                const targetEntry = dict[targetVar];
                if (graph.edges.pagesByUid[sourceId]) {
                  return [];
                } else if (isNode(targetEntry)) {
                  return targetEntry.uid ===
                    graph.edges.blocksPageByUid[sourceId]
                    ? [dict]
                    : [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: {
                        uid: graph.edges.blocksPageByUid[sourceId],
                      },
                    },
                  ];
                }
              } else if (rel === ":node/title") {
                if (target.type === "constant") {
                  if (graph.edges.pagesByUid[sourceId] === targetString) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else if (!graph.edges.pagesByUid[sourceId]) {
                  return [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.pagesByUid[sourceId],
                    },
                  ];
                }
              } else if (rel === ":block/children") {
                if (target.type !== "variable") {
                  console.warn(
                    "Expected target for :block/children to be a variable"
                  );
                  return [];
                }
                const targetEntry = dict[targetVar];
                const children = (
                  isNode(targetEntry)
                    ? [targetEntry.uid]
                    : graph.edges.childrenByUid[sourceId] || []
                ).map((child) => ({
                  ...dict,
                  [targetVar]: { uid: child },
                }));
                if (children.length) programs.vars.add(targetVar);
                return children;
              } else if (rel === ":block/parents") {
                if (target.type !== "variable") {
                  console.warn(
                    "Expected target for :block/parents to be a variable"
                  );
                  return [];
                }
                const targetEntry = dict[targetVar];
                const ancestors = (
                  isNode(targetEntry)
                    ? [targetEntry.uid]
                    : Array.from(graph.edges.ancestorsByUid[sourceId] || [])
                ).map((child) => ({
                  ...dict,
                  [targetVar]: { uid: child },
                }));
                if (ancestors.length) programs.vars.add(targetVar);
                return ancestors;
              } else if (rel === ":block/string") {
                if (target.type === "constant") {
                  if (graph.edges.blocksByUid[sourceId] === targetString) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.blocksByUid[sourceId],
                    },
                  ];
                }
              } else if (rel === ":block/heading") {
                if (target.type === "constant") {
                  if (
                    graph.edges.headingsByUid[sourceId] === Number(targetString)
                  ) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.headingsByUid[sourceId],
                    },
                  ];
                }
              } else if (rel === ":create/user") {
                if (target.type !== "variable") {
                  console.warn(
                    "Expected target for :create/user to be a variable"
                  );
                  return [];
                }
                const targetEntry = dict[targetVar];
                const userId = graph.edges.createUserByUid[sourceId];
                if (isNode(targetEntry)) {
                  return targetEntry.uid === userId ? [dict] : [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: { uid: userId },
                    },
                  ];
                }
              } else if (rel === ":edit/user") {
                if (target.type !== "variable") {
                  console.warn(
                    "Expected target for :edit/user to be a variable"
                  );
                  return [];
                }
                const targetEntry = dict[targetVar];
                const userId = graph.edges.editUserByUid[sourceId];
                if (isNode(targetEntry)) {
                  return targetEntry.uid === userId ? [dict] : [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: { uid: userId },
                    },
                  ];
                }
              } else if (rel === ":create/time") {
                if (target.type === "constant") {
                  if (
                    graph.edges.createTimeByUid[sourceId] ===
                    Number(targetString)
                  ) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.createTimeByUid[sourceId],
                    },
                  ];
                }
              } else if (rel === ":edit/time") {
                if (target.type === "constant") {
                  if (
                    graph.edges.editTimeByUid[sourceId] === Number(targetString)
                  ) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.editTimeByUid[sourceId],
                    },
                  ];
                }
              } else if (rel === ":user/display-name") {
                if (target.type === "constant") {
                  if (graph.edges.userDisplayByUid[sourceId] === targetString) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.userDisplayByUid[sourceId],
                    },
                  ];
                }
              } else {
                console.warn(`Unknown rel: ${rel}`);
                return [];
              }
            }
          );
          programs.assignments = new Set(newAssignments);
        } else if (target.type === "variable" && programs.vars.has(targetVar)) {
          const newAssignments = Array.from(programs.assignments).flatMap(
            (dict) => {
              const targetEntry = dict[targetVar];
              if (rel === ":block/refs") {
                if (!isNode(targetEntry)) {
                  console.warn(
                    "Expected the target variable to map to a node in :block/refs"
                  );
                  return [];
                }
                const targetId = targetEntry.uid;
                const refs = (
                  graph.edges.linkedReferencesByUid[targetId] || []
                ).map((ref) => ({
                  ...dict,
                  [v]: { uid: ref },
                }));
                if (refs.length) programs.vars.add(v);
                return refs;
              } else if (rel === ":block/page") {
                if (!isNode(targetEntry)) {
                  console.warn(
                    "Expected the target variable to map to a node in :block/page"
                  );
                  return [];
                }
                const targetId = targetEntry.uid;
                if (!graph.edges.pagesByUid[targetId]) {
                  return [];
                } else {
                  const children = Array.from(
                    graph.edges.descendantsByUid[targetId] || []
                  ).map((d) => ({
                    ...dict,
                    [v]: { uid: d },
                  }));
                  if (children.length) programs.vars.add(v);
                  return children;
                }
              } else if (rel === ":node/title") {
                if (typeof targetEntry !== "string") {
                  console.warn(
                    "Expected the target variable to map to a string in :block/refs"
                  );
                  return [];
                }
                const page = graph.edges.pageUidByTitle[targetEntry];
                if (page) {
                  programs.vars.add(v);
                  return [
                    {
                      ...dict,
                      [v]: { uid: page },
                    },
                  ];
                }
                return [];
              } else if (rel === ":block/children") {
                if (!isNode(targetEntry)) {
                  console.warn(
                    "Expected the target variable to map to a node in :block/children"
                  );
                  return [];
                }
                const targetId = targetEntry.uid;
                const parent = graph.edges.parentByUid[targetId];
                if (parent) {
                  programs.vars.add(v);
                  return [
                    {
                      ...dict,
                      [v]: { uid: parent },
                    },
                  ];
                } else {
                  return [];
                }
              } else if (rel === ":block/parents") {
                if (!isNode(targetEntry)) {
                  console.warn(
                    "Expected the target variable to map to a node in :block/parents"
                  );
                  return [];
                }
                const targetId = targetEntry.uid;
                const ancestors = Array.from(
                  graph.edges.ancestorsByUid[targetId] || []
                ).map((child) => ({
                  ...dict,
                  [v]: { uid: child },
                }));
                if (ancestors.length) programs.vars.add(v);
                return ancestors;
              } else if (rel === ":block/string") {
                if (typeof targetEntry !== "string") {
                  console.warn(
                    "Expected the target variable to map to a string in :block/string"
                  );
                  return [];
                }
                const blocks = Object.entries(graph.edges.blocksByUid)
                  .filter(([_, v]) => v === targetEntry)
                  .map(([child]) => ({
                    ...dict,
                    [v]: { uid: child },
                  }));
                if (blocks.length) programs.vars.add(v);
                return blocks;
              } else if (rel === ":block/heading") {
                if (typeof targetEntry !== "number") {
                  console.warn(
                    "Expected the target variable to map to a number in :block/heading"
                  );
                  return [];
                }
                const blocks = Object.entries(graph.edges.headingsByUid)
                  .filter(([_, v]) => v === targetEntry)
                  .map(([child]) => ({
                    ...dict,
                    [v]: { uid: child },
                  }));
                if (blocks.length) programs.vars.add(v);
                return blocks;
              } else if (rel === ":create/user") {
                if (!isNode(targetEntry)) {
                  console.warn(
                    "Expected the target variable to map to a node in :create/user"
                  );
                  return [];
                }
                const targetId = targetEntry.uid;
                const children = Object.keys(graph.edges.createUserByUid)
                  .filter(
                    (node) => graph.edges.createUserByUid[node] === targetId
                  )
                  .map((d) => ({
                    ...dict,
                    [v]: { uid: d },
                  }));
                if (children.length) programs.vars.add(v);
                return children;
              } else if (rel === ":edit/user") {
                if (!isNode(targetEntry)) {
                  console.warn(
                    "Expected the target variable to map to a node in :edit/user"
                  );
                  return [];
                }
                const targetId = targetEntry.uid;
                const children = Object.keys(graph.edges.editUserByUid)
                  .filter(
                    (node) =>
                      graph.edges.editUserByUid[Number(node)] === targetId
                  )
                  .map((d) => ({
                    ...dict,
                    [v]: { uid: d },
                  }));
                if (children.length) programs.vars.add(v);
                return children;
              } else if (rel === ":create/time") {
                if (typeof targetEntry !== "number") {
                  console.warn(
                    "Expected the target variable to map to a number in :create/time"
                  );
                  return [];
                }
                const blocks = Object.entries(graph.edges.createTimeByUid)
                  .filter(([_, v]) => v === targetEntry)
                  .map(([child]) => ({
                    ...dict,
                    [v]: { uid: child },
                  }));
                if (blocks.length) programs.vars.add(v);
                return blocks;
              } else if (rel === ":edit/time") {
                if (typeof targetEntry !== "number") {
                  console.warn(
                    "Expected the target variable to map to a number in :edit/time"
                  );
                  return [];
                }
                const blocks = Object.entries(graph.edges.editTimeByUid)
                  .filter(([_, v]) => v === targetEntry)
                  .map(([child]) => ({
                    ...dict,
                    [v]: { uid: child },
                  }));
                if (blocks.length) programs.vars.add(v);
                return blocks;
              } else if (rel === ":user/display-name") {
                if (typeof targetEntry !== "string") {
                  console.warn(
                    "Expected the target variable to map to a string in :block/refs"
                  );
                  return [];
                }
                const displayName = targetEntry
                  .replace(/^"/, "")
                  .replace(/"$/, "");
                const user = graph.edges.userUidByDisplay[displayName];
                if (user) {
                  programs.vars.add(v);
                  return [
                    {
                      ...dict,
                      [v]: { uid: user },
                    },
                  ];
                }
                return [];
              } else {
                console.warn(`Unknown rel: ${rel}`);
                return [];
              }
            }
          );
          programs.assignments = new Set(newAssignments);
        } else {
          const matches: Assignment[] =
            rel === ":block/refs"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.referencesByUid).flatMap(
                    ([source, refs]) =>
                      refs.map((ref) => ({
                        [v]: { uid: source },
                        [targetVar]: { uid: ref },
                      }))
                  )
              : rel === ":block/page"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.blocksPageByUid).map(([b, p]) => ({
                    [v]: { uid: b },
                    [targetVar]: { uid: p },
                  }))
              : rel === ":node/title"
              ? target.type === "constant"
                ? graph.edges.pageUidByTitle[targetString]
                  ? [{ [v]: { uid: graph.edges.pageUidByTitle[targetString] } }]
                  : []
                : target.type === "underscore"
                ? Object.values(graph.edges.pageUidByTitle).map((uid) => ({
                    [v]: { uid },
                  }))
                : Object.entries(graph.edges.pageUidByTitle).map(
                    ([title, uid]) => ({
                      [v]: { uid },
                      [targetVar]: title,
                    })
                  )
              : rel === ":block/children"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.childrenByUid).flatMap(
                    ([source, refs]) =>
                      refs.map((ref) => ({
                        [v]: { uid: source },
                        [targetVar]: { uid: ref },
                      }))
                  )
              : rel === ":block/parents"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.ancestorsByUid).flatMap(
                    ([source, refs]) =>
                      Array.from(refs).map((ref) => ({
                        [v]: { uid: source },
                        [targetVar]: { uid: ref },
                      }))
                  )
              : rel === ":block/string"
              ? target.type === "constant"
                ? Object.entries(graph.edges.blocksByUid)
                    .filter(([_, text]) => text !== targetString)
                    .map(([uid]) => ({ [v]: { uid } }))
                : target.type === "underscore"
                ? Object.keys(graph.edges.blocksByUid).map((uid) => ({
                    [v]: { uid },
                  }))
                : Object.entries(graph.edges.blocksByUid).map(
                    ([uid, text]) => ({
                      [v]: { uid },
                      [targetVar]: text,
                    })
                  )
              : rel === ":block/heading"
              ? target.type === "constant"
                ? Object.entries(graph.edges.headingsByUid)
                    .filter(([_, text]) => text !== Number(targetString))
                    .map(([uid]) => ({ [v]: { uid } }))
                : target.type === "underscore"
                ? Object.keys(graph.edges.headingsByUid).map((uid) => ({
                    [v]: { uid },
                  }))
                : Object.entries(graph.edges.headingsByUid).map(
                    ([uid, text]) => ({
                      [v]: { uid },
                      [targetVar]: text,
                    })
                  )
              : rel === ":create/user"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.createUserByUid).map(([b, p]) => ({
                    [v]: { uid: b },
                    [targetVar]: { uid: p },
                  }))
              : rel === ":edit/user"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.editUserByUid).map(([b, p]) => ({
                    [v]: { uid: b },
                    [targetVar]: { uid: p },
                  }))
              : rel === ":create/time"
              ? target.type === "constant"
                ? Object.entries(graph.edges.createTimeByUid)
                    .filter(([_, text]) => text !== Number(targetString))
                    .map(([uid]) => ({ [v]: { uid } }))
                : target.type === "underscore"
                ? Object.keys(graph.edges.createTimeByUid).map((uid) => ({
                    [v]: { uid },
                  }))
                : Object.entries(graph.edges.createTimeByUid).map(
                    ([uid, text]) => ({
                      [v]: { uid },
                      [targetVar]: text,
                    })
                  )
              : rel === ":edit/time"
              ? target.type === "constant"
                ? Object.entries(graph.edges.editTimeByUid)
                    .filter(([_, text]) => text !== Number(targetString))
                    .map(([uid]) => ({ [v]: { uid } }))
                : target.type === "underscore"
                ? Object.keys(graph.edges.editTimeByUid).map((uid) => ({
                    [v]: { uid },
                  }))
                : Object.entries(graph.edges.editTimeByUid).map(
                    ([uid, text]) => ({
                      [v]: { uid },
                      [targetVar]: text,
                    })
                  )
              : rel === ":user/display-name"
              ? target.type === "constant"
                ? graph.edges.userUidByDisplay[targetString]
                  ? [
                      {
                        [v]: {
                          uid: graph.edges.userUidByDisplay[targetString],
                        },
                      },
                    ]
                  : []
                : target.type === "underscore"
                ? Object.values(graph.edges.userUidByDisplay).map((uid) => ({
                    [v]: { uid },
                  }))
                : Object.entries(graph.edges.userUidByDisplay).map(
                    ([title, uid]) => ({
                      [v]: { uid },
                      [targetVar]: title,
                    })
                  )
              : [];
          reconcile(matches, target.type === "variable" ? [v, targetVar] : [v]);
        }
      } else if (
        clause.type === "or-clause" ||
        clause.type === "or-join-clause"
      ) {
        let matches: Assignment[] = [];
        for (const cls of clause.clauses) {
          const assignments = getAssignments([cls], Array.from(programs.vars));
          if (assignments.size) {
            matches = Array.from(assignments);
            break;
          }
        }
        const vars =
          clause.type === "or-join-clause"
            ? clause.variables.map((v) => v.value.toLowerCase())
            : Object.keys(matches[0] || {});
        const varSet = new Set(vars);
        matches.forEach((a) => {
          Object.keys(a).forEach((k) => {
            if (!varSet.has(k)) {
              delete a[k];
            }
          });
        });
        reconcile(matches, vars);
      } else if (clause.type === "and-clause") {
        const matches = Array.from(
          getAssignments(clause.clauses, Array.from(programs.vars))
        );
        reconcile(matches, Object.keys(matches[0] || {}));
      } else if (clause.type === "pred-expr") {
        if (clause.pred === "clojure.string/includes?") {
          const [variable, constant] = clause.arguments;
          if (variable?.type !== "variable") {
            console.warn(
              "Expected type to be variable for first clojure.string/includes? argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          const v = variable.value.toLowerCase();
          if (!programs.vars.has(v)) {
            console.warn(
              "Expected first clojure.string/includes? argument to be predefined variable."
            );
            programs.assignments = new Set();
            return programs;
          }
          if (constant?.type !== "constant") {
            console.warn(
              "Expected type to be constant for second clojure.string/includes? argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          const newAssignments = Array.from(programs.assignments).flatMap(
            (dict) => {
              const sourceEntry = dict[v];
              if (typeof sourceEntry !== "string") {
                console.warn("Expected the variable to map to a string");
                return [];
              }
              if (
                sourceEntry.includes(
                  constant.value.replace(/^"/, "").replace(/"$/, "")
                )
              ) {
                return [dict];
              } else {
                return [];
              }
            }
          );
          programs.assignments = new Set(newAssignments);
        } else if (clause.pred === "clojure.string/starts-with?") {
          const [variable, constant] = clause.arguments;
          const v = variable.value.toLowerCase();
          if (variable?.type !== "variable") {
            console.warn(
              "Expected type to be variable for first clojure.string/starts-with? argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          if (!programs.vars.has(v)) {
            console.warn(
              "Expected first clojure.string/starts-with? argument to be predefined variable."
            );
            programs.assignments = new Set();
            return programs;
          }
          if (constant?.type !== "constant") {
            console.warn(
              "Expected type to be constant for second clojure.string/starts-with? argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          const newAssignments = Array.from(programs.assignments).flatMap(
            (dict) => {
              const sourceEntry = dict[v];
              if (typeof sourceEntry !== "string") {
                console.warn("Expected the variable to map to a string");
                return [];
              }
              if (
                sourceEntry.startsWith(
                  constant.value.replace(/^"/, "").replace(/"$/, "")
                )
              ) {
                return [dict];
              } else {
                return [];
              }
            }
          );
          programs.assignments = new Set(newAssignments);
        } else if (clause.pred === "clojure.string/ends-with?") {
          const [variable, constant] = clause.arguments;
          const v = variable.value.toLowerCase();
          if (variable?.type !== "variable") {
            console.warn(
              "Expected type to be variable for first clojure.string/ends-with? argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          if (!programs.vars.has(v)) {
            console.warn(
              "Expected first clojure.string/ends-with? argument to be predefined variable."
            );
            programs.assignments = new Set();
            return programs;
          }
          if (constant?.type !== "constant") {
            console.warn(
              "Expected type to be constant for second clojure.string/ends-with? argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          const newAssignments = Array.from(programs.assignments).flatMap(
            (dict) => {
              const sourceEntry = dict[v];
              if (typeof sourceEntry !== "string") {
                console.warn("Expected the variable to map to a string");
                return [];
              }
              if (
                sourceEntry.endsWith(
                  constant.value.replace(/^"/, "").replace(/"$/, "")
                )
              ) {
                return [dict];
              } else {
                return [];
              }
            }
          );
          programs.assignments = new Set(newAssignments);
        } else if (clause.pred === "re-find") {
          const [regex, variable] = clause.arguments;
          const v = variable.value.toLowerCase();
          const r = regex.value.toLowerCase();
          if (variable?.type !== "variable") {
            console.warn(
              "Expected type to be variable for first re-find argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          if (!programs.vars.has(v)) {
            console.warn(
              "Expected first re-find argument to be predefined variable."
            );
            programs.assignments = new Set();
            return programs;
          }
          if (regex?.type !== "variable") {
            console.warn(
              "Expected type to be variable for second re-find argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          if (!programs.vars.has(r)) {
            console.warn(
              "Expected second re-find argument to be predefined variable."
            );
            programs.assignments = new Set();
            return programs;
          }
          const newAssignments = Array.from(programs.assignments).filter(
            (dict) => {
              const regexEntry = dict[r];
              if (!(regexEntry instanceof RegExp)) {
                console.warn("Expected the variable to map to a regexp");
                return false;
              }
              const targetEntry = dict[v];
              if (typeof targetEntry !== "string") {
                console.warn("Expected the variable to map to a string");
                return false;
              }
              return regexEntry.test(targetEntry);
            }
          );
          programs.assignments = new Set(newAssignments);
        } else if (clause.pred === ">") {
          const [left, right] = clause.arguments;
          const l = left.value.toLowerCase();
          const r = right.value.toLowerCase();
          if (left?.type === "variable" && !programs.vars.has(l)) {
            console.warn(
              "If left argument is a variable, it must be predefined"
            );
            programs.assignments = new Set();
            return programs;
          }
          if (right?.type === "variable" && !programs.vars.has(r)) {
            console.warn(
              "If right argument is a variable, it must be predefined"
            );
            programs.assignments = new Set();
            return programs;
          }
          const newAssignments = Array.from(programs.assignments).filter(
            (dict) => {
              const leftValue =
                left.type === "constant" ? Number(left.value) : dict[r];
              if (typeof leftValue !== "number") {
                console.warn("Left argument must be a number");
                return false;
              }
              const rightValue =
                right.type === "constant" ? Number(right.value) : dict[r];
              if (typeof leftValue !== "number") {
                console.warn("Right argument must be a number");
                return false;
              }
              return leftValue > rightValue;
            }
          );
          programs.assignments = new Set(newAssignments);
        } else if (clause.pred === "<") {
          const [left, right] = clause.arguments;
          const l = left.value.toLowerCase();
          const r = right.value.toLowerCase();
          if (left?.type === "variable" && !programs.vars.has(l)) {
            console.warn(
              "If left argument is a variable, it must be predefined"
            );
            programs.assignments = new Set();
            return programs;
          }
          if (right?.type === "variable" && !programs.vars.has(r)) {
            console.warn(
              "If right argument is a variable, it must be predefined"
            );
            programs.assignments = new Set();
            return programs;
          }
          const newAssignments = Array.from(programs.assignments).filter(
            (dict) => {
              const leftValue =
                left.type === "constant" ? Number(left.value) : dict[r];
              if (typeof leftValue !== "number") {
                console.warn("Left argument must be a number");
                return false;
              }
              const rightValue =
                right.type === "constant" ? Number(right.value) : dict[r];
              if (typeof leftValue !== "number") {
                console.warn("Right argument must be a number");
                return false;
              }
              return leftValue < rightValue;
            }
          );
          programs.assignments = new Set(newAssignments);
        } else {
          console.warn(`Unexpected predicate ${clause.pred}`);
          programs.assignments = new Set();
        }
      } else if (clause.type === "fn-expr") {
        if (clause.fn === "re-pattern") {
          const [constant] = clause.arguments;
          if (constant?.type !== "constant") {
            console.warn(
              "Expected type to be constant for first re-pattern argument."
            );
            programs.assignments = new Set();
            return programs;
          }
          const { binding } = clause;
          if (binding.type !== "bind-scalar") {
            console.warn(
              "Expected type to be scalar for first re-pattern binding."
            );
            programs.assignments = new Set();
            return programs;
          }
          const newAssignments = Array.from(programs.assignments).map(
            (dict) => {
              return {
                ...dict,
                [binding.variable.value.toLowerCase()]: new RegExp(
                  constant.value.replace(/^"/, "").replace(/"$/, "")
                ),
              };
            }
          );
          programs.assignments = new Set(newAssignments);
        } else {
          console.warn(`Unexpected fn name ${clause.fn}`);
          programs.assignments = new Set();
        }
      } else {
        console.warn(`Unexpected type ${clause.type}`);
        programs.assignments = new Set();
      }
      return programs;
    },
    {
      assignments: new Set<Assignment>([]),
      vars: new Set<string>(initialVars),
    }
  ).assignments;
};

const query = ({ where, pull }: QueryArgs) => {
  const assignments = getAssignments(where);
  return Array.from(assignments).map((res) =>
    Object.fromEntries(
      pull
        .map(({ _var, field, label }) => {
          const node = res[_var.toLowerCase()];
          if (isNode(node)) {
            if (field === ":node/title") {
              return [label, graph.edges.pagesByUid[node.uid]];
            } else if (field === ":block/string") {
              return [label, graph.edges.blocksByUid[node.uid]];
            } else if (field === ":block/uid") {
              return [label, node.uid];
            }
          }
          return [];
        })
        .filter((k) => k.length === 2 && typeof k[1] !== "undefined")
    )
  );
};

const fireQuery = ({ id, ...args }: { id: string } & QueryArgs) => {
  postMessage({ method: `fireQuery_${id}`, results: query(args) });
};

onmessage = (e) => {
  const { data = {} } = e;
  const { method, ...args } = data;
  if (method === "overview") {
    overview();
  } else if (method === "init") {
    init(args);
  } else if (method === "fireQuery") {
    fireQuery(args);
  }
};

export {};
