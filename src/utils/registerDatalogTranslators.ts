import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { DatalogAndClause, DatalogClause } from "roamjs-components/types";
import {
  getNodes,
  nodeFormatToDatalog,
  getRelations,
  matchNode,
  ANY_REGEX,
} from "../util";

const registerDatalogTranslators = () => {
  const { conditionToDatalog, registerDatalogTranslator } =
    window.roamjs.extension.queryBuilder;

  const isACallback: Parameters<
    typeof registerDatalogTranslator
  >[0]["callback"] = ({ source, target }) => {
    const formatByType = Object.fromEntries([
      ...discourseNodes.map((n) => [n.type, n.format]),
      ...discourseNodes.map((n) => [n.text, n.format]),
    ]);
    return [
      {
        type: "data-pattern",
        arguments: [
          {
            type: "variable",
            value: source,
          },
          { type: "constant", value: ":node/title" },
          {
            type: "variable",
            value: `${target}-Title`,
          },
        ],
      },
      ...nodeFormatToDatalog({
        freeVar: `${target}-Title`,
        nodeFormat: formatByType[target],
      }),
    ];
  };
  const discourseNodes = getNodes();
  registerDatalogTranslator({
    key: "is a",
    callback: isACallback,
  });
  registerDatalogTranslator({
    key: "self",
    callback: ({ source, uid }) => isACallback({ source, target: source, uid }),
  });

  const discourseRelations = getRelations();
  const nodeLabelByType = Object.fromEntries(
    discourseNodes.map((n) => [n.type, n.text])
  );
  const nodeFormatByType = Object.fromEntries(
    discourseNodes.map((n) => [n.type, n.format])
  );
  const nodeTypeByLabel = Object.fromEntries(
    discourseNodes.map((n) => [n.text.toLowerCase(), n.type])
  );
  const doesRelationMatchCondition = (
    relation: { source: string; destination: string },
    condition: { source: string; target: string }
  ) => {
    const sourceType = nodeLabelByType[relation.source];
    const targetType = nodeLabelByType[relation.destination];
    const sourceMatches = sourceType === condition.source;
    const targetMatches =
      targetType === condition.target ||
      matchNode({
        format: nodeFormatByType[relation.destination],
        title: condition.target,
      });
    if (sourceMatches) {
      return (
        targetMatches ||
        (!nodeTypeByLabel[condition.target.toLowerCase()] &&
          Object.values(nodeFormatByType).every(
            (format) => !matchNode({ format, title: condition.target })
          ))
      );
    }
    if (targetMatches) {
      return sourceMatches || !nodeTypeByLabel[condition.source.toLowerCase()];
    }
    // if both are placeholders, sourceType and targetType will both be null, meaning we could match any condition
    return false; // !nodeLabelByType[condition.source] && !nodeLabelByType[condition.target]
  };
  const relationLabels = new Set(
    discourseRelations.flatMap((d) => [d.label, d.complement])
  );
  relationLabels.add(ANY_REGEX.source);
  relationLabels.forEach((label) => {
    registerDatalogTranslator({
      key: label,
      callback: ({ source, target, uid }) => {
        const targetType = nodeTypeByLabel[target.toLowerCase()];
        const conditionTarget = targetType || target;
        const filteredRelations = discourseRelations
          .map((r) =>
            (r.label === label || ANY_REGEX.test(label)) &&
            doesRelationMatchCondition(r, { source, target })
              ? { ...r, forward: true }
              : doesRelationMatchCondition(
                  { source: r.destination, destination: r.source },
                  { source, target }
                ) &&
                (r.complement === label || ANY_REGEX.test(label))
              ? { ...r, forward: false }
              : undefined
          )
          .filter((r) => !!r);
        if (!filteredRelations.length) return [];
        const andParts = filteredRelations.map(
          ({ triples, source: _source, destination, forward }) => {
            const queryTriples = triples.map((t) => t.slice(0));
            const sourceTriple = queryTriples.find((t) => t[2] === "source");
            const destinationTriple = queryTriples.find(
              (t) => t[2] === "destination"
            );
            if (!sourceTriple || !destinationTriple) return [];
            let sourceNodeVar = "";
            if (forward) {
              /*   if (
                matchNode({
                  title: conditionTarget,
                  format: nodeFormatByType[destination],
                })
              ) {
                destinationTriple[1] = "has title";
                destinationTriple[2] = conditionTarget;
              }*/
              destinationTriple[1] = "has title";
              destinationTriple[2] = conditionTarget;
              sourceTriple[2] = _source;
              sourceNodeVar = sourceTriple[0];
            } else {
              /* if (
                matchNode({
                  title: conditionTarget,
                  format: nodeFormatByType[source],
                })
              ) {
                sourceTriple[1] = "has title";
                sourceTriple[2] = conditionTarget;
              }*/
              sourceTriple[1] = "has title";
              sourceTriple[2] = conditionTarget;
              destinationTriple[2] = destination;
              sourceNodeVar = destinationTriple[0];
            }
            const subQuery = queryTriples.flatMap(([src, rel, tar]) =>
              conditionToDatalog({
                source: src,
                relation: rel,
                target: tar,
                not: false,
                uid,
                type: "clause"
              })
            );
            const replaceVariables = (
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
                        if (a.value === sourceNodeVar) {
                          a.value = source;
                        } else {
                          a.value = `${uid}-${a.value}`;
                        }
                      });
                    break;
                  case "not-join-clause":
                  case "or-join-clause":
                    c.variables
                      .filter((a) => a.type === "variable")
                      .forEach((a) => {
                        if (a.value === sourceNodeVar) {
                          a.value = source;
                        } else {
                          a.value = `${uid}-${a.value}`;
                        }
                      });
                  case "not-clause":
                  case "or-clause":
                  case "and-clause":
                    replaceVariables(c.clauses);
                    break;
                  default:
                    return;
                }
              });
            replaceVariables(subQuery);
            return subQuery;
          }
        );
        if (andParts.length === 1) return andParts[0];
        const collectVariables = (
          clauses: (DatalogClause | DatalogAndClause)[]
        ): Set<string> =>
          new Set(
            clauses.flatMap((c) => {
              switch (c.type) {
                case "data-pattern":
                case "fn-expr":
                case "pred-expr":
                case "rule-expr":
                  return [...c.arguments]
                    .filter((a) => a.type === "variable")
                    .map((a) => a.value);
                case "not-join-clause":
                case "or-join-clause":
                case "not-clause":
                case "or-clause":
                case "and-clause":
                  return Array.from(collectVariables(c.clauses));
                default:
                  return [];
              }
            })
          );
        const orJoinedVars = collectVariables(andParts[0]);
        andParts.slice(1).forEach((a) => {
          const freeVars = collectVariables(a);
          Array.from(orJoinedVars).forEach((v) => {
            if (!freeVars.has(v)) orJoinedVars.delete(v);
          });
        });
        return [
          {
            type: "or-join-clause",
            variables: Array.from(orJoinedVars).map((v) => ({
              type: "variable",
              value: v,
            })),
            clauses: andParts.map((a) => ({
              type: "and-clause",
              clauses: a,
            })),
          },
        ];
      },
      targetOptions: (source) => {
        const pageNames = getAllPageNames();
        const sourcedRelations = discourseRelations
          .flatMap((dr) => [
            { source: dr.source, relation: dr.label },
            { source: dr.destination, relation: dr.complement },
          ])
          .filter(
            (dr) =>
              dr.relation === label && (!source || dr.source === source)
          );
        return pageNames.filter((p) =>
          sourcedRelations.some((sr) =>
            matchNode({
              format: nodeFormatByType[sr.source],
              title: p,
            })
          )
        );
      },
    });
  });
};

export default registerDatalogTranslators;
