// TODO LATER LIST
// - DEFAULT_[NODE|RELATIONS]_VALUES
// - Config, graph updates update cache

/* Metrics on Megacoglab
'blocksById' = 9123113 = 9.1 MB
'timeById' = 5244944 = 5.2 MB
'uidsById' = 1674506 = 1.7 MB
'parentById' = 1053482 = 1.0 MB
'blocksPageById' = 1039789 = 1.0 MB
'descendantsById' = 926990 = 0.9 MB
'ancestorsById' = 818911 = 0.8 MB
'childrenById' = 763575 = 0.7 MB
'referencesById' = 572326 = 0.5 MB
'linkedReferencesById' = 416106 = 0.4 MB
'pagesById' = 349505 = 0.3MB
'pageIdByTitle' = 330420 = 0.3MB

'discourseRelations': 0.5MB
'config': 6KB
 */

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
    childrenById: Record<number, number[]>;
    parentById: Record<number, number>;
    ancestorsById: Record<number, Set<number>>;
    descendantsById: Record<number, Set<number>>;
    timeById: Record<number, { createdTime: number; editedTime: number }>;
    referencesById: Record<number, number[]>;
    linkedReferencesById: Record<number, number[]>;
    createUserById: Record<number, number>;
    userDisplayById: Record<number, string>;
  };
  discourseRelations: {
    [pageId: number]: {
      label: string;
      target: string;
      results: { id: number; mapping: Record<string, number> }[];
    }[];
  };
} = {
  discourseRelations: {},
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
    childrenById: {},
    parentById: {},
    ancestorsById: {},
    descendantsById: {},
    timeById: {},
    referencesById: {},
    linkedReferencesById: {},
    createUserById: {},
    userDisplayById: {},
  },
};

const init = (
  blocks:
    | [
        {
          id: number;
          page?: { id: number };
          refs?: { id: number }[];
          title?: string;
          string?: string;
          uid: string;
          children?: { id: number }[];
          createdTime: number;
          editedTime: number;
          displayName?: string;
          createdBy?: number;
        }
      ][]
    | string
) => {
  if (typeof blocks === "string") {
    const { discourseRelations, config, edges } = JSON.parse(
      blocks
    ) as typeof graph;
    graph.discourseRelations = discourseRelations;
    graph.config = config;
    graph.edges = edges;
    postMessage({ method: "init" });
    return;
  }
  blocks.forEach(
    ([
      {
        id,
        page,
        refs,
        title,
        string,
        children,
        uid,
        createdTime,
        editedTime,
        displayName,
        createdBy,
      },
    ]) => {
      graph.edges.uidsById[id] = uid;
      graph.edges.createUserById[id] = createdBy;
      graph.edges.timeById[id] = { createdTime, editedTime };
      if (!title && !string) {
        graph.edges.userDisplayById[id] = displayName;
      } else if (!page) {
        graph.edges.pagesById[id] = title;
        graph.edges.pageIdByTitle[title] = id;
        if (title === "roam/js/discourse-graph") {
          graph.config.id = id;
        }
      } else {
        graph.edges.blocksById[id] = string;
        graph.edges.blocksPageById[id] = page.id;
      }
      if (refs) {
        refs.forEach(({ id: refId }) => {
          if (graph.edges.linkedReferencesById[refId]) {
            graph.edges.linkedReferencesById[refId].push(id);
          } else {
            graph.edges.linkedReferencesById[refId] = [id];
          }
        });
        graph.edges.referencesById[id] = refs.map(({ id }) => id);
      }
      if (children) {
        graph.edges.childrenById[id] = children.map(({ id }) => id);
        children.forEach((c) => (graph.edges.parentById[c.id] = id));
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

  graph.config.nodes = (
    graph.edges.childrenById[grammarChildren.find(findChild("nodes"))] || []
  ).map((n) => {
    const nchildren = graph.edges.childrenById[n] || [];
    return {
      format: graph.edges.blocksById[n],
      type: graph.edges.uidsById[n],
      text: graph.edges.blocksById[nchildren[0]] || "",
      shortcut: graph.edges.blocksById[nchildren[0]] || "",
    };
  });
  graph.config.relations = (
    graph.edges.childrenById[grammarChildren.find(findChild("relations"))] || []
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
            const lastChild = (graph.edges.childrenById[firstChild] || [])?.[0];
            return [
              graph.edges.blocksById[t] || "",
              graph.edges.blocksById[firstChild] || "",
              graph.edges.blocksById[lastChild] || "",
            ];
          }),
      };
    });
  });

  //  Object.entries(uidsById).forEach()
  const pagesByNodeType = Object.fromEntries(
    graph.config.nodes.flatMap(({ type, text }) => [
      [type, new Set<number>()],
      [text, new Set<number>()],
    ])
  );
  const allPages = new Set(
    Object.keys(graph.edges.pagesById).map((i) => Number(i))
  );
  const allBlocks = new Set(
    Object.keys(graph.edges.blocksById).map((i) => Number(i))
  );

  const getDescendants = (id: number) => {
    const des = graph.edges.childrenById[id] || [];
    const desSet = new Set(des);
    des.flatMap((i) => getDescendants(i)).forEach((i) => desSet.add(i));
    graph.edges.descendantsById[id] = desSet;
    return Array.from(desSet);
  };
  allPages.forEach((id) => {
    const title = graph.edges.pagesById[id];
    const node = graph.config.nodes.find(({ format }) =>
      matchNode({ format, title })
    );
    if (node) {
      pagesByNodeType[node.type].add(id);
      pagesByNodeType[node.text].add(id);
    }
    getDescendants(id);
  });

  allBlocks.forEach((id) => {
    graph.edges.ancestorsById[id] = new Set();
    for (
      let i = graph.edges.parentById[id];
      !!i;
      i = graph.edges.parentById[i]
    ) {
      graph.edges.ancestorsById[id].add(i);
    }
  });

  const isTargetVar = (rel: string) =>
    !["is a", "has title", "with text"].includes(rel);

  const reduceTriples = (
    triples: string[][],
    initialVar: string,
    id: number
  ) => {
    const marked = triples.map(() => false);
    const orderedTriples: string[][] = [];
    const capturedVars = new Set([initialVar]);
    for (
      let i = 0;
      i < triples.length && orderedTriples.length < triples.length;
      i++
    ) {
      triples.forEach((t, i) => {
        if (marked[i]) return;
        if (capturedVars.has(t[0].toLowerCase())) {
          if (isTargetVar(t[1].toLowerCase()))
            capturedVars.add(t[2].toLowerCase());
          orderedTriples.push(t);
          marked[i] = true;
        } else if (capturedVars.has(t[2].toLowerCase())) {
          capturedVars.add(t[0].toLowerCase());
          orderedTriples.push(t);
          marked[i] = true;
        }
      });
    }
    return orderedTriples.reduce(
      (programs, triple) => {
        if (programs.assignments.size === 0) return programs;
        const v = triple[0].toLowerCase();
        const rel = triple[1].toLowerCase();
        const target = triple[2];
        const targetVar = target.toLowerCase();
        if (programs.vars.has(v)) {
          const newAssignments = Array.from(programs.assignments).flatMap(
            (dict) => {
              const sourceId = dict[v];
              if (rel === "is a") {
                if (pagesByNodeType[target].has(sourceId)) {
                  return [dict];
                } else {
                  return [];
                }
              } else if (rel === "references") {
                const refs = (
                  dict[targetVar]
                    ? [dict[targetVar]]
                    : graph.edges.referencesById[sourceId] || []
                ).map((ref) => ({
                  ...dict,
                  [targetVar]: ref,
                }));
                if (refs.length) programs.vars.add(targetVar);
                return refs;
              } else if (rel === "is in page") {
                if (graph.edges.pagesById[sourceId]) {
                  return [];
                } else if (dict[targetVar]) {
                  return dict[targetVar] ===
                    graph.edges.blocksPageById[sourceId]
                    ? [dict]
                    : [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: graph.edges.blocksPageById[sourceId],
                    },
                  ];
                }
              } else if (rel === "has title") {
                if (graph.edges.pagesById[sourceId] === target) {
                  return [dict];
                } else {
                  return [];
                }
              } else if (rel === "has attribute") {
                return [dict];
              } else if (rel === "has child") {
                const children = (
                  dict[targetVar]
                    ? [dict[targetVar]]
                    : graph.edges.childrenById[sourceId] || []
                ).map((child) => ({
                  ...dict,
                  [targetVar]: child,
                }));
                if (children.length) programs.vars.add(targetVar);
                return children;
              } else if (rel === "has ancestor") {
                // ancestor by id
                const ancestors = (
                  dict[targetVar]
                    ? [dict[targetVar]]
                    : Array.from(graph.edges.ancestorsById[sourceId] || [])
                ).map((child) => ({
                  ...dict,
                  [targetVar]: child,
                }));
                if (ancestors.length) programs.vars.add(targetVar);
                return ancestors;
              } else if (rel === "has descendant") {
                // descendant by id
                const descendants = (
                  dict[targetVar]
                    ? [dict[targetVar]]
                    : Array.from(graph.edges.descendantsById[sourceId] || [])
                ).map((child) => ({
                  ...dict,
                  [targetVar]: child,
                }));
                if (descendants.length) programs.vars.add(targetVar);
                return descendants;
              } else if (rel === "with text") {
                if (graph.edges.blocksById[sourceId].includes(targetVar)) {
                  return [dict];
                } else {
                  return [];
                }
              }
            }
          );
          programs.assignments = new Set(newAssignments);
        } else if (programs.vars.has(targetVar)) {
          const newAssignments = Array.from(programs.assignments).flatMap(
            (dict) => {
              const targetId = dict[targetVar];
              if (rel === "references") {
                const refs = (
                  graph.edges.linkedReferencesById[targetId] || []
                ).map((ref) => ({
                  ...dict,
                  [v]: ref,
                }));
                if (refs.length) programs.vars.add(v);
                return refs;
              } else if (rel === "is in page") {
                if (!graph.edges.pagesById[targetId]) {
                  return [];
                } else {
                  const children = Array.from(
                    graph.edges.descendantsById[targetId] || []
                  ).map((d) => ({
                    ...dict,
                    [v]: d,
                  }));
                  if (children.length) programs.vars.add(v);
                  return children;
                }
              } else if (rel === "has attribute") {
                return [dict];
              } else if (rel === "has child") {
                const parent = graph.edges.parentById[targetId];
                if (parent) {
                  programs.vars.add(v);
                  return [
                    {
                      ...dict,
                      [v]: parent,
                    },
                  ];
                } else {
                  return [];
                }
              } else if (rel === "has descendant") {
                const ancestors = (
                  dict[v]
                    ? [dict[v]]
                    : Array.from(graph.edges.ancestorsById[targetId] || [])
                ).map((child) => ({
                  ...dict,
                  [v]: child,
                }));
                if (ancestors.length) programs.vars.add(v);
                return ancestors;
              } else if (rel === "has ancestor") {
                const descendants = (
                  dict[v]
                    ? [dict[v]]
                    : Array.from(graph.edges.descendantsById[targetId] || [])
                ).map((child) => ({
                  ...dict,
                  [v]: child,
                }));
                if (descendants.length) programs.vars.add(v);
                return descendants;
              }
            }
          );
          programs.assignments = new Set(newAssignments);
        } else {
          const matches: { [v: string]: number }[] =
            rel === "is a"
              ? Array.from(pagesByNodeType[target]).map((m) => ({ [v]: m }))
              : rel === "references"
              ? Object.entries(graph.edges.referencesById).flatMap(
                  ([source, refs]) =>
                    refs.map((ref) => ({
                      [v]: Number(source),
                      [targetVar]: ref,
                    }))
                )
              : rel === "is in page"
              ? Object.entries(graph.edges.blocksPageById).map((b, p) => ({
                  [v]: Number(b),
                  [targetVar]: p,
                }))
              : rel === "has title"
              ? [{ [v]: graph.edges.pageIdByTitle[target] }]
              : rel === "has attribute"
              ? []
              : rel === "has child"
              ? Object.entries(graph.edges.childrenById).flatMap(
                  ([source, refs]) =>
                    refs.map((ref) => ({
                      [v]: Number(source),
                      [targetVar]: ref,
                    }))
                )
              : rel === "has ancestor"
              ? Object.entries(graph.edges.ancestorsById).flatMap(
                  ([source, refs]) =>
                    Array.from(refs).map((ref) => ({
                      [v]: Number(source),
                      [targetVar]: ref,
                    }))
                )
              : rel === "has descendant"
              ? Object.entries(graph.edges.descendantsById).flatMap(
                  ([source, refs]) =>
                    Array.from(refs).map((ref) => ({
                      [v]: Number(source),
                      [targetVar]: ref,
                    }))
                )
              : rel === "with text"
              ? Array.from(allBlocks).map((m) => ({ [v]: m }))
              : [];
          programs.assignments = new Set(
            Array.from(programs.assignments).flatMap((dict) =>
              matches.map((dic) => ({
                ...dict,
                ...dic,
              }))
            )
          );
          programs.vars.add(v);
          if (isTargetVar(rel)) {
            programs.vars.add(target);
          }
        }
        return programs;
      },
      {
        assignments: new Set([
          {
            [initialVar]: id,
          },
        ]),
        vars: new Set([initialVar]),
      }
    );
  };

  Object.entries(graph.edges.pagesById).forEach(([_id, title]) => {
    const start = new Date();
    const id = Number(_id);
    const nodeType = graph.config.nodes.find(({ format }) =>
      matchNode({ format, title })
    )?.type;
    const discourseRelations = nodeType
      ? [
          ...graph.config.relations
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
              const triples = [
                ...r.triples.filter(
                  (t) => t !== sourceTriple && t !== destinationTriple
                ),
                [destinationTriple[0], destinationTriple[1], r.destination],
              ];
              const programs = reduceTriples(
                triples,
                sourceTriple[0].toLowerCase(),
                id
              );
              return {
                label: r.label,
                target: r.destination,
                results: Array.from(programs.assignments).map((dict) => ({
                  id: dict[destinationTriple[0].toLowerCase()],
                  mapping: dict,
                })),
              };
            }),
          ...graph.config.relations
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
              const triples = [
                ...r.triples.filter(
                  (t) => t !== sourceTriple && t !== destinationTriple
                ),
                [sourceTriple[0], sourceTriple[1], r.source],
              ];
              const programs = reduceTriples(
                triples,
                destinationTriple[0].toLowerCase(),
                id
              );
              return {
                label: r.complement,
                target: r.source,
                results: Array.from(programs.assignments).map((dict) => ({
                  id: dict[sourceTriple[0].toLowerCase()],
                  mapping: dict,
                })),
              };
            }),
        ].filter((a) => !!a.results.length)
      : undefined;

    graph.discourseRelations[id] = discourseRelations;
  });

  postMessage({ method: "init", graph: JSON.stringify(graph) });
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

type Result = {
  text: string;
  uid: string;
  createdTime: number;
  editedTime: number;
};

const getDiscourseContextResults = (title: string) => {
  const rawResults = graph.discourseRelations[graph.edges.pageIdByTitle[title]];
  if (!rawResults) return [];
  const nodeTextByType = Object.fromEntries(
    graph.config.nodes.map(({ type, text }) => [type, text])
  );
  const groupedResults = Object.fromEntries(
    rawResults.map((r) => [
      r.label,
      {} as Record<string, Partial<Result & { target: string }>>,
    ])
  );
  rawResults.forEach((r) =>
    r.results.forEach((tag) => {
      const uid = graph.edges.uidsById[tag.id];
      groupedResults[r.label][uid] = {
        uid,
        ...graph.edges.timeById[tag.id],
        text: graph.edges.pagesById[tag.id],
        target: nodeTextByType[r.target],
      };
    })
  );
  return Object.entries(groupedResults).map(([label, results]) => ({
    label,
    results,
  }));
};

const discourse = (tag: string) => {
  postMessage({
    method: `discourse-${tag}`,
    refs:
      graph.edges.linkedReferencesById[graph.edges.pageIdByTitle[tag]]
        ?.length || 0,
    results: getDiscourseContextResults(tag),
  });
};

onmessage = (e) => {
  const { data } = e;
  if (data.method === "discourse") {
    discourse(data.tag);
  } else if (data.method === "init") {
    init(data.blocks);
  }
};

export {};
