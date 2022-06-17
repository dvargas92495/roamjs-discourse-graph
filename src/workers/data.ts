import { unpack } from "msgpackr/unpack";
import apiGet from "roamjs-components/util/apiGet";
import apiPut from "roamjs-components/util/apiPut";
import { Graph } from "./types";
import fireQuery from "./methods/fireQuery";
import { openDB } from "idb";

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

const graph: Graph = resetGraph();

const getSnapshotFromIdb = (graph: string) =>
  openDB(`v10_SLASH_dbs_SLASH_${graph}`).then((db) => db.getAll("snapshot"));

const accessBlocksDirectly = (graph: string) => {
  return getSnapshotFromIdb(graph)
    .then((result) => {
      try {
        return unpack(result[0].db_msgpack_array) as {
          eavt: [number, number, unknown][];
          attrs: string[];
        };
      } catch (e) {
        return Promise.reject(`Failed to unpack Roam data: ${e.message}`);
      }
    })
    .then((serialized) => {
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
  "~:node/title"?: string;
  "~:block/heading"?: number;
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
  "~:db.fn/retractEntity"?: UpdateNode;
  "~:version/id"?: string;
  "~:version/nonce"?: string;
  "~:block/open"?: boolean;
  "~:user/settings"?: UpdateNode;
  "~:attrs/lookup"?: UpdateNode;
  "~:edit/seen-by"?: UpdateNode;
  "~:ent/emojis"?: UpdateNode;
};

const processUpdates = (updates: UpdateNode[]) => {
  return updates.find((update) => {
    try {
      if (update["~:version/id"]) {
        // ignore - dont care about version updates
      } else if (update["~:user/settings"]) {
        // ignore - dont care about user settings
      } else if (update["~:attrs/lookup"]) {
        // ignore - dont care about user settings
      } else if (update["~:db/add"]) {
        const blockUid = update["~:db/add"]["~:block/uid"];
        if (
          Object.keys(update).length === 2 &&
          typeof update["~:block/children"] !== "undefined"
        ) {
          const childUid = (update["~:block/children"] as UpdateNode)[
            "~:block/uid"
          ];
          graph.edges.childrenByUid[blockUid] = (
            graph.edges.childrenByUid[blockUid] || []
          ).concat([childUid]);
          delete graph.edges.parentByUid[childUid];
        } else if (
          Object.keys(update).length === 2 &&
          typeof update["~:block/order"] !== "undefined"
        ) {
          const parentUid = graph.edges.parentByUid[blockUid];
          graph.edges.childrenByUid[parentUid] = (
            graph.edges.childrenByUid[parentUid] || []
          ).filter((b) => b !== blockUid);
          graph.edges.childrenByUid[parentUid].splice(
            update["~:block/order"],
            0,
            blockUid
          );
        } else if (
          Object.keys(update).length === 2 &&
          typeof update["~:block/open"] !== "undefined"
        ) {
          // TODO
        } else if (Object.keys(update).length === 2 && update["~:block/page"]) {
          graph.edges.blocksPageByUid[update["~:db/add"]["~:block/uid"]] =
            update["~:block/page"]["~:block/uid"];
        } else if (
          Object.keys(update).length === 2 &&
          update["~:version/nonce"]
        ) {
          // skip, nothing to do when undos occur
        } else if (Object.keys(update).length === 2 && update["~:edit/time"]) {
          graph.edges.editTimeByUid[update["~:db/add"]["~:block/uid"]] =
            update["~:edit/time"];
        } else if (
          Object.keys(update).length === 2 &&
          update["~:block/string"]
        ) {
          graph.edges.blocksByUid[update["~:db/add"]["~:block/uid"]] =
            update["~:block/string"];
        } else {
          console.warn("unknown db/add update: ", update);
          return true;
        }
      } else if (update["~:db/retract"]) {
        const parentUid = update["~:db/retract"]["~:block/uid"];
        if (
          Object.keys(update).length === 2 &&
          typeof update["~:block/children"] !== "undefined"
        ) {
          const childUid = (update["~:block/children"] as UpdateNode)[
            "~:block/uid"
          ];
          graph.edges.childrenByUid[parentUid] = (
            graph.edges.childrenByUid[parentUid] || []
          ).filter((i) => childUid !== i);
          delete graph.edges.parentByUid[childUid];
        } else if (
          Object.keys(update).length === 2 &&
          typeof update["~:block/refs"] !== "undefined"
        ) {
          const refUid = (update["~:block/refs"] as UpdateNode)["~:block/uid"];
          graph.edges.referencesByUid[parentUid] = graph.edges.referencesByUid[
            parentUid
          ].filter((i) => refUid !== i);
          graph.edges.linkedReferencesByUid[refUid] = (
            graph.edges.linkedReferencesByUid[refUid] || []
          ).filter((i) => parentUid !== i);
        } else if (
          Object.keys(update).length === 2 &&
          typeof update["~:block/parents"] !== "undefined"
        ) {
          const ancestor = (update["~:block/parents"] as UpdateNode)[
            "~:block/uid"
          ];
          graph.edges.ancestorsByUid[parentUid] = (
            graph.edges.ancestorsByUid[parentUid] || []
          ).filter((uid) => uid !== ancestor);
          graph.edges.descendantsByUid[ancestor] = (
            graph.edges.descendantsByUid[parentUid] || []
          ).filter((uid) => uid !== parentUid);
        } else if (
          Object.keys(update).length === 2 &&
          update["~:version/nonce"]
        ) {
          // skip, nothing to do with undos
        } else if (Object.keys(update).length === 2 && update["~:edit/time"]) {
          delete graph.edges.editTimeByUid[
            update["~:db/retract"]["~:block/uid"]
          ];
        } else if (
          Object.keys(update).length === 2 &&
          update["~:block/string"]
        ) {
          delete graph.edges.blocksByUid[update["~:db/retract"]["~:block/uid"]];
        } else {
          console.warn("unknown db/retract update: ", update);
          return true;
        }
      } else if (update["~:db.fn/retractEntity"]) {
        const uid = update["~:db.fn/retractEntity"]["~:block/uid"];
        delete graph.edges.blocksByUid[uid];
        delete graph.edges.createTimeByUid[uid];
        delete graph.edges.createUserByUid[uid];
        delete graph.edges.editTimeByUid[uid];
        delete graph.edges.editUserByUid[uid];

        (graph.edges.referencesByUid[uid] || []).forEach((ref) => {
          graph.edges.linkedReferencesByUid[uid] =
            graph.edges.linkedReferencesByUid[uid].filter((r) => r !== ref);
        });
        delete graph.edges.referencesByUid[uid];

        const parent = graph.edges.parentByUid[uid];
        graph.edges.childrenByUid[parent] = (
          graph.edges.childrenByUid[parent] || []
        ).filter((c) => c !== uid);
        delete graph.edges.parentByUid[uid];

        (graph.edges.descendantsByUid[uid] || []).forEach((d) => {
          graph.edges.ancestorsByUid[d] = graph.edges.ancestorsByUid[d].filter(
            (a) => a !== uid
          );
        });
        delete graph.edges.descendantsByUid[uid];

        const title = graph.edges.pagesByUid[uid];
        delete graph.edges.pageUidByTitle[title];
        delete graph.edges.pagesByUid[uid];
      } else if (update["~:block/uid"]) {
        const blockUid = update["~:block/uid"];
        if (
          Object.keys(update).length === 2 &&
          typeof update["~:block/order"] !== "undefined"
        ) {
          const parentUid = graph.edges.parentByUid[blockUid];
          graph.edges.childrenByUid[parentUid] = graph.edges.childrenByUid[
            parentUid
          ].filter((b) => b !== blockUid);
          graph.edges.childrenByUid[parentUid].splice(
            update["~:block/order"],
            0,
            blockUid
          );
        } else if (
          Object.keys(update).length === 2 &&
          typeof update["~:ent/emojis"] !== "undefined"
        ) {
          // ignore - dont care about emojis
        } else if (
          Object.keys(update).length === 2 &&
          typeof update["~:edit/seen-by"] !== "undefined"
        ) {
          // ignore - dont care about edit seen by
        } else if (
          Object.keys(update).length === 2 &&
          update["~:block/children"]
        ) {
          const blocks = update["~:block/children"] as UpdateNode[];
          blocks.forEach((child) => {
            const uid = child["~:block/uid"];
            if (child["~:edit/time"])
              graph.edges.editTimeByUid[uid] = child["~:edit/time"];
            if (child["~:edit/user"])
              graph.edges.editUserByUid[uid] =
                child["~:edit/user"]["~:user/uid"];
            if (child["~:create/time"])
              graph.edges.createTimeByUid[uid] = child["~:create/time"];
            if (child["~:create/user"])
              graph.edges.createUserByUid[uid] =
                child["~:create/user"]["~:user/uid"];
            if (typeof child["~:block/string"] !== "undefined")
              graph.edges.blocksByUid[uid] = child["~:block/string"];
            graph.edges.headingsByUid[uid] = child["~:block/heading"] || 0;
            // TODO :block/open
            if (typeof child["~:block/order"] !== "undefined") {
              graph.edges.childrenByUid[blockUid] =
                graph.edges.childrenByUid[blockUid] || [];
              graph.edges.childrenByUid[blockUid].splice(
                child["~:block/order"],
                0,
                uid
              );
            }
          });
        } else if (
          Object.keys(update).length === 2 &&
          update["~:block/parents"]
        ) {
          const parentUids = (update["~:block/parents"] as UpdateNode[]).map(
            (u) => u["~:block/uid"]
          );
          const parentUid = parentUids[parentUids.length - 1];
          graph.edges.parentByUid[blockUid] = parentUid;
          graph.edges.ancestorsByUid[blockUid] = parentUids.reverse();
        } else if (
          Object.keys(update).length === 4 &&
          typeof update["~:block/string"] !== "undefined"
        ) {
          graph.edges.blocksByUid[blockUid] = update["~:block/string"];
          graph.edges.editTimeByUid[blockUid] = update["~:edit/time"];
          const user = update["~:edit/user"];
          graph.edges.editUserByUid[blockUid] = user["~:user/uid"];
        } else if (Object.keys(update).length === 2 && update["~:block/refs"]) {
          const refs = update["~:block/refs"].map((r) => r["~:block/uid"]);
          graph.edges.referencesByUid[blockUid] = (
            graph.edges.referencesByUid[blockUid] || []
          ).concat(refs);
          refs.forEach((refId) => {
            if (graph.edges.linkedReferencesByUid[refId]) {
              graph.edges.linkedReferencesByUid[refId].push(blockUid);
            } else {
              graph.edges.linkedReferencesByUid[refId] = [blockUid];
            }
          });
        } else if (Object.keys(update).length === 7 && update["~:node/title"]) {
          graph.edges.pagesByUid[blockUid] = update["~:node/title"];
          graph.edges.createTimeByUid[blockUid] = update["~:create/time"];
          graph.edges.createUserByUid[blockUid] =
            update["~:create/user"]["~:user/uid"];
          graph.edges.editTimeByUid[blockUid] = update["~:edit/time"];
          graph.edges.editUserByUid[blockUid] =
            update["~:edit/user"]["~:user/uid"];
        } else {
          console.warn("unknown block/uid update: ", update);
          return true;
        }
      } else {
        console.warn("unknown update: ", update);
        return true;
      }
    } catch (e) {
      console.warn("failed to parse update", update, "with error", e);
      return true;
    }
  });
};

const parseTxData = (s: string) => {
  const fields = Array.from(s.matchAll(/"~[:#][a-zA-Z.\/-]+"/g)).map((k) =>
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
    updates[0] === "~#list"
      ? parseUpdates(updates[1] as unknown[])
      : updates[0] === null
      ? parseUpdates(updates.slice(1))
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
  authorization?: string;
  cached: boolean;
}) => {
  clearTimeout(graph.updater);
  const update = () => {
    // @ts-ignore
    graph.updater = global.setTimeout(updateWithLog, 10000) as number;
  };
  const save = () =>
    authorization
      ? apiPut({
          path: "file",
          data: {
            extension: "discourse-graph",
            body: JSON.stringify(graph),
            path: `graph-cache/${id}.json`,
          },
          authorization,
        }).then(update)
      : Promise.resolve().then(update);
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
        // Using `some` to do forEach with `break`
        const failedToParse = results.find((result) => {
          // ts why is this not discriminated without the `=== true`??
          if (result.deleted_by_snapshot === true) {
            graph.latest = result.source_t;
            return;
          }
          const txName = result.tx_meta["tx-name"];
          const updates = parseTxData(result.tx);
          const failed = processUpdates(updates);
          if (failed) {
            console.warn(
              "didnt know how to parse event",
              txName,
              "data",
              JSON.parse(result.tx)
            );
            return true;
          }
          graph.latest = result.source_t;
          return false;
        });
        if (failedToParse) {
          // send email to RoamJS about failure
        }
        return save();
      });
  };
  if (cached && authorization) {
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
      update();
    });
  } else {
    // TODO: only on refresh data
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

// todo - move init, overview
onmessage = (e) => {
  const { data = {} } = e;
  const { method, ...args } = data;
  if (method === "overview") {
    overview();
  } else if (method === "init") {
    init(args);
  } else if (method === "fireQuery") {
    fireQuery(graph)(args);
  }
};

export {};
