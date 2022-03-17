import {
  getNodes,
  nodeFormatToDatalog,
  getRelations,
  matchNode,
  ANY_REGEX,
} from "../util";

const registerDatalogTranslators = () => {
  const { conditionToDatalog } = window.roamjs.extension.queryBuilder;
  const registerDatalogTransfer = window.roamjs.extension.queryBuilder //@ts-ignore
    ?.registerDatalogTranslator as (args: {
    key: string;
    callback: (args: {
      freeVar: (s: string) => string;
      source: string;
      target: string;
      uid: string;
    }) => string;
  }) => void;

  const discourseNodes = getNodes();
  registerDatalogTransfer({
    key: "is a",
    callback: ({ source, target, freeVar }) => {
      const formatByType = Object.fromEntries([
        ...discourseNodes.map((n) => [n.type, n.format]),
        ...discourseNodes.map((n) => [n.text, n.format]),
      ]);
      return `[${freeVar(source)} :node/title ${freeVar(
        target
      )}-Title] ${nodeFormatToDatalog({
        freeVar: `${freeVar(target)}-Title`,
        nodeFormat: formatByType[target],
      })}`;
    },
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
    const sourceMatches = nodeLabelByType[relation.source] === condition.source;
    const targetMatches =
      relation.destination === nodeLabelByType[condition.target] ||
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
    return false;
  };
  const relationLabels = new Set(
    discourseRelations.flatMap((d) => [d.label, d.complement])
  );
  relationLabels.add(ANY_REGEX.source);
  relationLabels.forEach((label) => {
    registerDatalogTransfer({
      key: label,
      callback: ({ source, target, uid, freeVar }) => {
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
        if (!filteredRelations.length) return "";
        return `(or-join [?${source}] ${filteredRelations.map(
          ({ triples, source: _source, destination, forward }) => {
            const queryTriples = triples.map((t) => t.slice(0));
            const sourceTriple = queryTriples.find((t) => t[2] === "source");
            const destinationTriple = queryTriples.find(
              (t) => t[2] === "destination"
            );
            if (!sourceTriple || !destinationTriple) return "";
            let sourceNodeVar = "";
            if (forward) {
              destinationTriple[1] = "Has Title";
              destinationTriple[2] = conditionTarget;
              sourceTriple[2] = _source;
              sourceNodeVar = sourceTriple[0];
            } else {
              sourceTriple[1] = "Has Title";
              sourceTriple[2] = conditionTarget;
              destinationTriple[2] = destination;
              sourceNodeVar = destinationTriple[0];
            }
            const subQuery = queryTriples
              .map(([src, rel, tar]) =>
                conditionToDatalog({
                  source: src,
                  relation: rel,
                  target: tar,
                  not: false,
                  uid,
                })
              )
              .join("\n");
            const andQuery = `\n  (and ${subQuery.replace(
              /([\s|\[]\?)/g,
              `$1${uid}-`
            )})`;
            return andQuery.replace(
              new RegExp(`\\?${uid}-${sourceNodeVar}`, "g"),
              `?${source}`
            );
          }
        ).join('\n')}\n)`;
      },
    });
  });
};

export default registerDatalogTranslators;
