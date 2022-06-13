import {
  DatalogAndClause,
  DatalogClause,
} from "roamjs-components/types/native";
import { Graph } from "../types";

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

const fireQuery = (graph: Graph) => {
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
                      graph.edges.headingsByUid[sourceId] ===
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
                      graph.edges.editTimeByUid[sourceId] ===
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
                        [targetVar]: graph.edges.editTimeByUid[sourceId],
                      },
                    ];
                  }
                } else if (rel === ":user/display-name") {
                  if (target.type === "constant") {
                    if (
                      graph.edges.userDisplayByUid[sourceId] === targetString
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
          } else if (
            target.type === "variable" &&
            programs.vars.has(targetVar)
          ) {
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
                  : Object.entries(graph.edges.blocksPageByUid).map(
                      ([b, p]) => ({
                        [v]: { uid: b },
                        [targetVar]: { uid: p },
                      })
                    )
                : rel === ":node/title"
                ? target.type === "constant"
                  ? graph.edges.pageUidByTitle[targetString]
                    ? [
                        {
                          [v]: {
                            uid: graph.edges.pageUidByTitle[targetString],
                          },
                        },
                      ]
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
                  : Object.entries(graph.edges.createUserByUid).map(
                      ([b, p]) => ({
                        [v]: { uid: b },
                        [targetVar]: { uid: p },
                      })
                    )
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
            reconcile(
              matches,
              target.type === "variable" ? [v, targetVar] : [v]
            );
          }
        } else if (
          clause.type === "or-clause" ||
          clause.type === "or-join-clause"
        ) {
          let matches: Assignment[] = [];
          for (const cls of clause.clauses) {
            const assignments = getAssignments(
              [cls],
              Array.from(programs.vars)
            );
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
  return ({ id, where, pull }: { id: string } & QueryArgs) => {
    const assignments = getAssignments(where);
    const results = Array.from(assignments).map((res) =>
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
    postMessage({ method: `fireQuery_${id}`, results });
  };
};

export default fireQuery;
