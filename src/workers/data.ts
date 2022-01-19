// TODO LATER LIST
// - DEFAULT_[NODE|RELATIONS]_VALUES
// - Config, graph updates update cache

const graph: {
  pages: {
    [k: string]: {
      linkedReferences: number[];
      uid: string;
      createdTime: number;
      editedTime: number;
      discourseRelations?: {
        label: string;
        target: string;
        results: string[];
      }[];
    };
  };
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
} = {
  pages: {},
  config: {
    nodes: [],
    relations: [],
    id: 0,
  },
};

const init = (
  blocks:
    | [
        {
          id: number;
          page?: { id: number };
          refs?: { id: number }[];
          text?: string;
          uid: string;
          children?: { id: number }[];
          createdTime: number;
          editedTime: number;
        }
      ][]
    | string
) => {
  if (typeof blocks === "string") {
    const { pages, config } = JSON.parse(blocks) as typeof graph;
    graph.pages = pages;
    graph.config = config;
    postMessage({ method: "init" });
    return;
  }
  const uidsById: Record<number, string> = {};
  const pagesById: Record<number, string> = {};
  const pageIdByTitle: Record<string, number> = {};
  const blocksPageById: Record<number, number> = {};
  const blocksById: Record<number, string> = {};
  const childrenById: Record<number, number[]> = {};
  const parentById: Record<number, number> = {};
  const ancestorsById: Record<number, Set<number>> = {};
  const descendantsById: Record<number, Set<number>> = {};
  const timeById: Record<number, { createdTime: number; editedTime: number }> =
    {};
  const referencesById: Record<number, number[]> = {};
  const linkedReferencesById: Record<number, number[]> = {};
  blocks.forEach(
    ([{ id, page, refs, text, children, uid, createdTime, editedTime }]) => {
      if (!text) {
        // users are blocks that get pulled by our query. Skip them
        return;
      }
      uidsById[id] = uid;
      timeById[id] = { createdTime, editedTime };
      if (!page) {
        pagesById[id] = text;
        pageIdByTitle[text] = id;
        if (text === "roam/js/discourse-graph") {
          graph.config.id = id;
        }
      } else {
        blocksById[id] = text;
        blocksPageById[id] = page.id;
      }
      if (refs) {
        refs.forEach(({ id: refId }) => {
          if (linkedReferencesById[refId]) {
            linkedReferencesById[refId].push(id);
          } else {
            linkedReferencesById[refId] = [id];
          }
        });
        referencesById[id] = refs.map(({ id }) => id);
      }
      if (children) {
        childrenById[id] = children.map(({ id }) => id);
        children.forEach((c) => (parentById[c.id] = id));
      }
    }
  );

  const findChild = (text: string) => (c: number) =>
    new RegExp(`^\\s*${text}\\s*$`, "i").test(blocksById[c]);
  const getSettingValueFromTree = ({
    tree,
    key,
  }: {
    tree: number[];
    key: string;
  }) => blocksById[childrenById[tree.find(findChild(key))]?.[0]] || "";
  const grammarChildren =
    childrenById[
      (childrenById[graph.config.id] || []).find(findChild("grammar"))
    ] || [];

  graph.config.nodes = (
    childrenById[grammarChildren.find(findChild("nodes"))] || []
  ).map((n) => {
    const nchildren = childrenById[n] || [];
    return {
      format: blocksById[n],
      type: uidsById[n],
      text: blocksById[nchildren[0]] || "",
      shortcut: blocksById[nchildren[0]] || "",
    };
  });
  graph.config.relations = (
    childrenById[grammarChildren.find(findChild("relations"))] || []
  ).flatMap((r, i) => {
    const tree = childrenById[r] || [];
    const data = {
      id: uidsById[r] || `${blocksById[r]}-${i}`,
      label: blocksById[r],
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
    return childrenById[tree.find(findChild("if"))].map((c) => {
      return {
        ...data,
        triples: (childrenById[c] || [])
          .filter((t) => !/node positions/i.test(blocksById[t]))
          .map((t) => {
            const firstChild = (childrenById[t] || [])?.[0];
            const lastChild = (childrenById[firstChild] || [])?.[0];
            return [
              blocksById[t] || "",
              blocksById[firstChild] || "",
              blocksById[lastChild] || "",
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
  const allPages = new Set(Object.keys(pagesById).map((i) => Number(i)));
  const allBlocks = new Set(Object.keys(blocksById).map((i) => Number(i)));

  const getDescendants = (id: number) => {
    const des = childrenById[id] || [];
    const desSet = new Set(des);
    des.flatMap((i) => getDescendants(i)).forEach((i) => desSet.add(i));
    descendantsById[id] = desSet;
    return Array.from(desSet);
  };
  allPages.forEach((id) => {
    const title = pagesById[id];
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
    ancestorsById[id] = new Set();
    for (let i = parentById[id]; !!i; i = parentById[i]) {
      ancestorsById[id].add(i);
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
                    : referencesById[sourceId] || []
                ).map((ref) => ({
                  ...dict,
                  [targetVar]: ref,
                }));
                if (refs.length) programs.vars.add(targetVar);
                return refs;
              } else if (rel === "is in page") {
                if (pagesById[sourceId]) {
                  return [];
                } else if (dict[targetVar]) {
                  return dict[targetVar] === blocksPageById[sourceId]
                    ? [dict]
                    : [];
                } else {
                  programs.vars.add(targetVar);
                  return [
                    {
                      ...dict,
                      [targetVar]: blocksPageById[sourceId],
                    },
                  ];
                }
              } else if (rel === "has title") {
                if (pagesById[sourceId] === target) {
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
                    : childrenById[sourceId] || []
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
                    : Array.from(ancestorsById[sourceId] || [])
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
                    : Array.from(descendantsById[sourceId] || [])
                ).map((child) => ({
                  ...dict,
                  [targetVar]: child,
                }));
                if (descendants.length) programs.vars.add(targetVar);
                return descendants;
              } else if (rel === "with text") {
                if (blocksById[sourceId].includes(targetVar)) {
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
                const refs = (linkedReferencesById[targetId] || []).map(
                  (ref) => ({
                    ...dict,
                    [v]: ref,
                  })
                );
                if (refs.length) programs.vars.add(v);
                return refs;
              } else if (rel === "is in page") {
                if (!pagesById[targetId]) {
                  return [];
                } else {
                  const children = Array.from(
                    descendantsById[targetId] || []
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
                const parent = parentById[targetId];
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
                    : Array.from(ancestorsById[targetId] || [])
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
                    : Array.from(descendantsById[targetId] || [])
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
              ? Object.entries(referencesById).flatMap(([source, refs]) =>
                  refs.map((ref) => ({ [v]: Number(source), [targetVar]: ref }))
                )
              : rel === "is in page"
              ? Object.entries(blocksPageById).map((b, p) => ({
                  [v]: Number(b),
                  [targetVar]: p,
                }))
              : rel === "has title"
              ? [{ [v]: pageIdByTitle[target] }]
              : rel === "has attribute"
              ? []
              : rel === "has child"
              ? Object.entries(childrenById).flatMap(([source, refs]) =>
                  refs.map((ref) => ({ [v]: Number(source), [targetVar]: ref }))
                )
              : rel === "has ancestor"
              ? Object.entries(ancestorsById).flatMap(([source, refs]) =>
                  Array.from(refs).map((ref) => ({
                    [v]: Number(source),
                    [targetVar]: ref,
                  }))
                )
              : rel === "has descendant"
              ? Object.entries(descendantsById).flatMap(([source, refs]) =>
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

  Object.entries(pagesById).forEach(([_id, title]) => {
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
                results: Array.from(programs.assignments)
                  .map((dict) => dict[destinationTriple[0].toLowerCase()])
                  .map((id) => pagesById[id] || blocksById[id]),
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
                results: Array.from(programs.assignments)
                  .map((dict) => dict[sourceTriple[0].toLowerCase()])
                  .map((id) => pagesById[id] || blocksById[id]),
              };
            }),
        ]
      : undefined;

    graph.pages[title] = {
      linkedReferences: linkedReferencesById[id],
      uid: uidsById[id],
      ...timeById[id],
      discourseRelations,
    };
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
  const rawResults = graph.pages[title].discourseRelations;
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
      const { createdTime, editedTime, uid } = graph.pages[tag];
      groupedResults[r.label][uid] = {
        uid,
        editedTime,
        createdTime,
        text: tag,
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
    refs: graph.pages[tag]?.linkedReferences?.length || 0,
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
