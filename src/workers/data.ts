// TODO LATER LIST
// - DEFAULT_[NODE|RELATIONS]_VALUES
// - Config, graph updates update cache

import type {
  DatalogAndClause,
  DatalogClause,
} from "roamjs-components/types/native";
import type { Result } from "roamjs-components/types/query-builder";
import { unpack } from "msgpackr/unpack";

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
    id: number;
  };
  edges: {
    pagesById: Record<number, string>;
    uidsById: Record<number, string>;
    pageIdByTitle: Record<string, number>;
    blocksPageById: Record<number, number>;
    blocksById: Record<number, string>;
    headingsById: Record<number, number>;
    childrenById: Record<number, number[]>;
    parentById: Record<number, number>;
    ancestorsById: Record<number, number[]>;
    descendantsById: Record<number, number[]>;
    referencesById: Record<number, number[]>;
    linkedReferencesById: Record<number, number[]>;
    createUserById: Record<number, number>;
    editUserById: Record<number, number>;
    createTimeById: Record<number, number>;
    editTimeById: Record<number, number>;
    userDisplayById: Record<number, string>;
    userIdByDisplay: Record<string, number>;
  };
} = {
  config: {
    nodes: [],
    relations: [],
    id: 0,
  },
  edges: {
    pagesById: {},
    uidsById: {},
    pageIdByTitle: {},
    blocksPageById: {},
    blocksById: {},
    headingsById: {},
    childrenById: {},
    parentById: {},
    ancestorsById: {},
    descendantsById: {},
    referencesById: {},
    linkedReferencesById: {},
    createUserById: {},
    editUserById: {},
    createTimeById: {},
    editTimeById: {},
    userDisplayById: {},
    userIdByDisplay: {},
  },
};

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
      serialized.eavt.forEach((eavt) => {
        const [e, a, v] = eavt;
        const attr = serialized.attrs[a];
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

const init = (_graph: string | typeof graph) => {
  if (typeof _graph !== "string") {
    const { config, edges } = _graph;
    graph.config = config;
    graph.edges = edges;
    postMessage({ method: "init" });
    return;
  }
  accessBlocksDirectly(_graph).then((blocks) => {
    blocks.forEach(
      ({
        id,
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
        graph.edges.uidsById[id] = uid;
        graph.edges.createUserById[id] = createdBy;
        graph.edges.editUserById[id] = editedBy;
        graph.edges.createTimeById[id] = createdTime;
        graph.edges.editTimeById[id] = editedTime;
        if (!title && !string) {
          graph.edges.userDisplayById[id] = displayName;
          graph.edges.userIdByDisplay[displayName] = id;
        } else if (!page && title) {
          graph.edges.pagesById[id] = title;
          graph.edges.pageIdByTitle[title] = id;
          if (title === "roam/js/discourse-graph") {
            graph.config.id = id;
          }
        } else if (page) {
          graph.edges.blocksById[id] = string;
          graph.edges.headingsById[id] = heading || 0;
          graph.edges.blocksPageById[id] = page;
        }
        if (refs) {
          refs.forEach((refId) => {
            if (graph.edges.linkedReferencesById[refId]) {
              graph.edges.linkedReferencesById[refId].push(id);
            } else {
              graph.edges.linkedReferencesById[refId] = [id];
            }
          });
          graph.edges.referencesById[id] = refs.slice(0);
        }
        if (children) {
          graph.edges.childrenById[id] = children.slice(0);
          children.forEach((c) => (graph.edges.parentById[c] = id));
        }
      }
    );

    const findChild = (text: string) => (c: number) =>
      new RegExp(`^\\s*${text}\\s*$`, "i").test(graph.edges.blocksById[c]);
    const getSettingValueFromTree = ({
      tree,
      key,
    }: {
      tree: number[];
      key: string;
    }) =>
      graph.edges.blocksById[
        graph.edges.childrenById[tree.find(findChild(key))]?.[0]
      ] || "";
    const grammarChildren =
      graph.edges.childrenById[
        (graph.edges.childrenById[graph.config.id] || []).find(
          findChild("grammar")
        )
      ] || [];

    graph.config.nodes = Object.entries(graph.edges.pagesById)
      .filter(([, title]) => title.startsWith("discourse-graph/nodes/"))
      .map(([_id, text]) => {
        const id = Number(_id);
        const nchildren = graph.edges.childrenById[id] || [];
        return {
          format:
            graph.edges.blocksById[
              (graph.edges.childrenById[nchildren.find(findChild("format"))] ||
                [])[0]
            ],
          type: graph.edges.uidsById[id],
          text,
          shortcut:
            graph.edges.blocksById[
              (graph.edges.childrenById[
                nchildren.find(findChild("shortcut"))
              ] || [])[0]
            ],
        };
      });
    graph.config.relations = (
      graph.edges.childrenById[grammarChildren.find(findChild("relations"))] ||
      []
    ).flatMap((r, i) => {
      const tree = graph.edges.childrenById[r] || [];
      const data = {
        id: graph.edges.uidsById[r] || `${graph.edges.blocksById[r]}-${i}`,
        label: graph.edges.blocksById[r],
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
      return graph.edges.childrenById[tree.find(findChild("if"))].map((c) => {
        return {
          ...data,
          triples: (graph.edges.childrenById[c] || [])
            .filter((t) => !/node positions/i.test(graph.edges.blocksById[t]))
            .map((t) => {
              const firstChild = (graph.edges.childrenById[t] || [])?.[0];
              const lastChild = (graph.edges.childrenById[firstChild] ||
                [])?.[0];
              return [
                graph.edges.blocksById[t] || "",
                graph.edges.blocksById[firstChild] || "",
                graph.edges.blocksById[lastChild] || "",
              ];
            }),
        };
      });
    });

    const allPages = new Set(
      Object.keys(graph.edges.pagesById).map((i) => Number(i))
    );
    const allBlocks = new Set(
      Object.keys(graph.edges.blocksById).map((i) => Number(i))
    );

    const getDescendants = (id: number): number[] => {
      const des = (graph.edges.childrenById[id] || []).flatMap((i) => [
        i,
        ...getDescendants(i),
      ]);
      graph.edges.descendantsById[id] = des;
      return des;
    };
    allPages.forEach(getDescendants);

    allBlocks.forEach((id) => {
      graph.edges.ancestorsById[id] = [];
      for (
        let i = graph.edges.parentById[id];
        !!i;
        i = graph.edges.parentById[i]
      ) {
        graph.edges.ancestorsById[id].push(i);
      }
    });

    postMessage({ method: "init", graph: JSON.stringify(graph) });
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
  const nodes = Object.entries(graph.edges.pagesById)
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

type NodeAssignment = { id: number };
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
          programs.assignments.size === 0 && index === 0
            ? matches
            : Array.from(programs.assignments).flatMap((dict) =>
                matches.map((dic) => ({
                  ...dict,
                  ...dic,
                }))
              )
        );
      };
      if (clause.type === "data-pattern") {
        const [source, relation, target] = clause.arguments;
        if (source.type !== "variable") {
          console.warn("Expected source type to be variable");
          return programs;
        }
        const v = source.value.toLowerCase();
        if (relation.type !== "constant") {
          console.warn("Expected relation type to be constant");
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
              const sourceId = sourceEntry.id;
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
                    ? [targetEntry.id]
                    : graph.edges.referencesById[sourceId] || []
                ).map((ref) => ({
                  ...dict,
                  [targetVar]: { id: ref },
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
                if (graph.edges.pagesById[sourceId]) {
                  return [];
                } else if (isNode(targetEntry)) {
                  return targetEntry.id === graph.edges.blocksPageById[sourceId]
                    ? [dict]
                    : [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: { id: graph.edges.blocksPageById[sourceId] },
                    },
                  ];
                }
              } else if (rel === ":node/title") {
                if (target.type === "constant") {
                  if (graph.edges.pagesById[sourceId] === targetString) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.pagesById[sourceId],
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
                    ? [targetEntry.id]
                    : graph.edges.childrenById[sourceId] || []
                ).map((child) => ({
                  ...dict,
                  [targetVar]: { id: child },
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
                    ? [targetEntry.id]
                    : Array.from(graph.edges.ancestorsById[sourceId] || [])
                ).map((child) => ({
                  ...dict,
                  [targetVar]: { id: child },
                }));
                if (ancestors.length) programs.vars.add(targetVar);
                return ancestors;
              } else if (rel === ":block/string") {
                if (target.type === "constant") {
                  if (graph.edges.blocksById[sourceId] === targetString) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.blocksById[sourceId],
                    },
                  ];
                }
              } else if (rel === ":block/heading") {
                if (target.type === "constant") {
                  if (
                    graph.edges.headingsById[sourceId] === Number(targetString)
                  ) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.headingsById[sourceId],
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
                const userId = graph.edges.createUserById[sourceId];
                if (isNode(targetEntry)) {
                  return targetEntry.id === userId ? [dict] : [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: { id: userId },
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
                const userId = graph.edges.editUserById[sourceId];
                if (isNode(targetEntry)) {
                  return targetEntry.id === userId ? [dict] : [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: { id: userId },
                    },
                  ];
                }
              } else if (rel === ":create/time") {
                if (target.type === "constant") {
                  if (
                    graph.edges.createTimeById[sourceId] ===
                    Number(targetString)
                  ) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.createTimeById[sourceId],
                    },
                  ];
                }
              } else if (rel === ":edit/time") {
                if (target.type === "constant") {
                  if (
                    graph.edges.editTimeById[sourceId] === Number(targetString)
                  ) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.editTimeById[sourceId],
                    },
                  ];
                }
              } else if (rel === ":user/display-name") {
                if (target.type === "constant") {
                  if (graph.edges.userDisplayById[sourceId] === targetString) {
                    return [dict];
                  } else {
                    return [];
                  }
                } else if (target.type === "underscore") {
                  return [dict];
                } else {
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.userDisplayById[sourceId],
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
                const targetId = targetEntry.id;
                const refs = (
                  graph.edges.linkedReferencesById[targetId] || []
                ).map((ref) => ({
                  ...dict,
                  [v]: { id: ref },
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
                const targetId = targetEntry.id;
                if (!graph.edges.pagesById[targetId]) {
                  return [];
                } else {
                  const children = Array.from(
                    graph.edges.descendantsById[targetId] || []
                  ).map((d) => ({
                    ...dict,
                    [v]: { id: d },
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
                const page = graph.edges.pageIdByTitle[targetEntry];
                if (page) {
                  programs.vars.add(v);
                  return [
                    {
                      ...dict,
                      [v]: { id: page },
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
                const targetId = targetEntry.id;
                const parent = graph.edges.parentById[targetId];
                if (parent) {
                  programs.vars.add(v);
                  return [
                    {
                      ...dict,
                      [v]: { id: parent },
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
                const targetId = targetEntry.id;
                const ancestors = Array.from(
                  graph.edges.ancestorsById[targetId] || []
                ).map((child) => ({
                  ...dict,
                  [v]: { id: child },
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
                const blocks = Object.entries(graph.edges.blocksById)
                  .filter(([_, v]) => v === targetEntry)
                  .map(([child]) => ({
                    ...dict,
                    [v]: { id: Number(child) },
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
                const blocks = Object.entries(graph.edges.headingsById)
                  .filter(([_, v]) => v === targetEntry)
                  .map(([child]) => ({
                    ...dict,
                    [v]: { id: Number(child) },
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
                const targetId = targetEntry.id;
                const children = Object.keys(graph.edges.createUserById)
                  .filter(
                    (node) =>
                      graph.edges.createUserById[Number(node)] === targetId
                  )
                  .map((d) => ({
                    ...dict,
                    [v]: { id: Number(d) },
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
                const targetId = targetEntry.id;
                const children = Object.keys(graph.edges.editUserById)
                  .filter(
                    (node) =>
                      graph.edges.editUserById[Number(node)] === targetId
                  )
                  .map((d) => ({
                    ...dict,
                    [v]: { id: Number(d) },
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
                const blocks = Object.entries(graph.edges.createTimeById)
                  .filter(([_, v]) => v === targetEntry)
                  .map(([child]) => ({
                    ...dict,
                    [v]: { id: Number(child) },
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
                const blocks = Object.entries(graph.edges.editTimeById)
                  .filter(([_, v]) => v === targetEntry)
                  .map(([child]) => ({
                    ...dict,
                    [v]: { id: Number(child) },
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
                const user = graph.edges.userIdByDisplay[displayName];
                if (user) {
                  programs.vars.add(v);
                  return [
                    {
                      ...dict,
                      [v]: { id: Number(user) },
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
          const matches: { [v: string]: number | string | { id: number } }[] =
            rel === ":block/refs"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.referencesById).flatMap(
                    ([source, refs]) =>
                      refs.map((ref) => ({
                        [v]: { id: Number(source) },
                        [targetVar]: { id: ref },
                      }))
                  )
              : rel === ":block/page"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.blocksPageById).map((b, p) => ({
                    [v]: { id: Number(b) },
                    [targetVar]: { id: p },
                  }))
              : rel === ":node/title"
              ? target.type === "constant"
                ? graph.edges.pageIdByTitle[targetString]
                  ? [{ [v]: { id: graph.edges.pageIdByTitle[targetString] } }]
                  : []
                : target.type === "underscore"
                ? Object.values(graph.edges.pageIdByTitle).map((id) => ({
                    [v]: { id },
                  }))
                : Object.entries(graph.edges.pageIdByTitle).map(
                    ([title, id]) => ({
                      [v]: { id },
                      [targetVar]: title,
                    })
                  )
              : rel === ":block/children"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.childrenById).flatMap(
                    ([source, refs]) =>
                      refs.map((ref) => ({
                        [v]: { id: Number(source) },
                        [targetVar]: { id: ref },
                      }))
                  )
              : rel === ":block/parents"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.ancestorsById).flatMap(
                    ([source, refs]) =>
                      Array.from(refs).map((ref) => ({
                        [v]: { id: Number(source) },
                        [targetVar]: { id: ref },
                      }))
                  )
              : rel === ":block/string"
              ? target.type === "constant"
                ? Object.entries(graph.edges.blocksById)
                    .filter(([_, text]) => text !== targetString)
                    .map(([id]) => ({ [v]: { id: Number(id) } }))
                : target.type === "underscore"
                ? Object.keys(graph.edges.blocksById).map((id) => ({
                    [v]: { id: Number(id) },
                  }))
                : Object.entries(graph.edges.blocksById).map(([id, text]) => ({
                    [v]: { id: Number(id) },
                    [targetVar]: text,
                  }))
              : rel === ":block/heading"
              ? target.type === "constant"
                ? Object.entries(graph.edges.headingsById)
                    .filter(([_, text]) => text !== Number(targetString))
                    .map(([id]) => ({ [v]: { id: Number(id) } }))
                : target.type === "underscore"
                ? Object.keys(graph.edges.headingsById).map((id) => ({
                    [v]: { id: Number(id) },
                  }))
                : Object.entries(graph.edges.headingsById).map(
                    ([id, text]) => ({
                      [v]: { id: Number(id) },
                      [targetVar]: text,
                    })
                  )
              : rel === ":create/user"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.createUserById).map((b, p) => ({
                    [v]: { id: Number(b) },
                    [targetVar]: { id: p },
                  }))
              : rel === ":edit/user"
              ? target.type !== "variable"
                ? []
                : Object.entries(graph.edges.editUserById).map((b, p) => ({
                    [v]: { id: Number(b) },
                    [targetVar]: { id: p },
                  }))
              : rel === ":create/time"
              ? target.type === "constant"
                ? Object.entries(graph.edges.createTimeById)
                    .filter(([_, text]) => text !== Number(targetString))
                    .map(([id]) => ({ [v]: { id: Number(id) } }))
                : target.type === "underscore"
                ? Object.keys(graph.edges.createTimeById).map((id) => ({
                    [v]: { id: Number(id) },
                  }))
                : Object.entries(graph.edges.createTimeById).map(
                    ([id, text]) => ({
                      [v]: { id: Number(id) },
                      [targetVar]: text,
                    })
                  )
              : rel === ":edit/time"
              ? target.type === "constant"
                ? Object.entries(graph.edges.editTimeById)
                    .filter(([_, text]) => text !== Number(targetString))
                    .map(([id]) => ({ [v]: { id: Number(id) } }))
                : target.type === "underscore"
                ? Object.keys(graph.edges.editTimeById).map((id) => ({
                    [v]: { id: Number(id) },
                  }))
                : Object.entries(graph.edges.editTimeById).map(
                    ([id, text]) => ({
                      [v]: { id: Number(id) },
                      [targetVar]: text,
                    })
                  )
              : rel === ":user/display-name"
              ? target.type === "constant"
                ? graph.edges.userIdByDisplay[targetString]
                  ? [{ [v]: { id: graph.edges.userIdByDisplay[targetString] } }]
                  : []
                : target.type === "underscore"
                ? Object.values(graph.edges.userIdByDisplay).map((id) => ({
                    [v]: { id },
                  }))
                : Object.entries(graph.edges.userIdByDisplay).map(
                    ([title, id]) => ({
                      [v]: { id },
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
            return programs;
          }
          const v = variable.value.toLowerCase();
          if (!programs.vars.has(v)) {
            console.warn(
              "Expected first clojure.string/includes? argument to be predefined variable."
            );
            return programs;
          }
          if (constant?.type !== "constant") {
            console.warn(
              "Expected type to be constant for second clojure.string/includes? argument."
            );
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
            return programs;
          }
          if (!programs.vars.has(v)) {
            console.warn(
              "Expected first clojure.string/starts-with? argument to be predefined variable."
            );
            return programs;
          }
          if (constant?.type !== "constant") {
            console.warn(
              "Expected type to be constant for second clojure.string/starts-with? argument."
            );
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
            return programs;
          }
          if (!programs.vars.has(v)) {
            console.warn(
              "Expected first clojure.string/ends-with? argument to be predefined variable."
            );
            return programs;
          }
          if (constant?.type !== "constant") {
            console.warn(
              "Expected type to be constant for second clojure.string/ends-with? argument."
            );
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
            return programs;
          }
          if (!programs.vars.has(v)) {
            console.warn(
              "Expected first re-find argument to be predefined variable."
            );
            return programs;
          }
          if (regex?.type !== "variable") {
            console.warn(
              "Expected type to be variable for second re-find argument."
            );
            return programs;
          }
          if (!programs.vars.has(r)) {
            console.warn(
              "Expected second re-find argument to be predefined variable."
            );
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
            return programs;
          }
          if (right?.type === "variable" && !programs.vars.has(r)) {
            console.warn(
              "If right argument is a variable, it must be predefined"
            );
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
            return programs;
          }
          if (right?.type === "variable" && !programs.vars.has(r)) {
            console.warn(
              "If right argument is a variable, it must be predefined"
            );
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
          return programs;
        }
      } else if (clause.type === "fn-expr") {
        if (clause.fn === "re-pattern") {
          const [constant] = clause.arguments;
          if (constant?.type !== "constant") {
            console.warn(
              "Expected type to be constant for first re-pattern argument."
            );
            return programs;
          }
          const { binding } = clause;
          if (binding.type !== "bind-scalar") {
            console.warn(
              "Expected type to be scalar for first re-pattern binding."
            );
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
          return programs;
        } else {
          console.warn(`Unexpected fn name ${clause.fn}`);
          return programs;
        }
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
              return [label, graph.edges.pagesById[node.id]];
            } else if (field === ":block/string") {
              return [label, graph.edges.blocksById[node.id]];
            } else if (field === ":block/uid") {
              return [label, graph.edges.uidsById[node.id]];
            }
          }
          return [];
        })
        .filter((k) => k.length === 2 && typeof k[1] !== "undefined")
    )
  );
};

const fireQuery = ({ uuid, ...args }: { uuid: string } & QueryArgs) => {
  postMessage({ method: `fireQuery_${uuid}`, results: query(args) });
};

onmessage = (e) => {
  const { data = {} } = e;
  const { method, ...args } = data;
  if (method === "overview") {
    overview();
  } else if (method === "init") {
    init(args.graph);
  } else if (method === "fireQuery") {
    fireQuery(args);
  }
};

export {};
