import { evaluate } from "mathjs";
import getSubTree from "roamjs-components/util/getSubTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import {
  ANY_RELATION_REGEX,
  findDiscourseNode,
  getDiscourseContextResults,
  getNodes,
  getRelations,
} from "../util";
import getAttributeValueByBlockAndName from "roamjs-components/queries/getAttributeValueByBlockAndName";

const getRelatedResults = ({
  uid,
  nodes,
  relations,
  relationLabel,
  target,
}: Parameters<typeof getDiscourseContextResults>[0] & {
  relationLabel: string;
  target: string;
}) =>
  getDiscourseContextResults({
    uid,
    nodes,
    relations: ANY_RELATION_REGEX.test(relationLabel)
      ? relations
      : relations.filter(
          (r) => relationLabel === r.label || relationLabel === r.complement
        ),
  }).then((results) =>
    results
      .flatMap((r) => Object.values(r.results))
      .filter((r) => /any/i.test(target) || r.target === target)
  );

const deriveNodeAttribute = async ({
  attribute,
  uid,
}: {
  attribute: string;
  uid: string;
}): Promise<string | number> => {
  const relations = getRelations();
  const nodes = getNodes(relations);
  const discourseNode = findDiscourseNode(uid, nodes);
  if (!discourseNode) return 0;
  const nodeType = discourseNode.type;
  const attributeNode = getSubTree({
    tree: getBasicTreeByParentUid(nodeType || ""),
    key: "Attributes",
  });
  const scoreFormula = getSettingValueFromTree({
    tree: attributeNode.children,
    key: attribute,
    defaultValue: "{count:Has Any Relation To:any}",
  });
  let postProcess = scoreFormula;
  let totalOffset = 0;
  const matches = scoreFormula.matchAll(/{([^}]+)}/g);
  for (const match of matches) {
    const [op, ...args] = match[1].split(":");
    const value =
      op === "count"
        ? await getRelatedResults({
            uid,
            nodes,
            relations,
            relationLabel: args[0],
            target: args[1],
          }).then((results) => results.length)
        : op === "attribute"
        ? getAttributeValueByBlockAndName({
            name: args[0],
            uid,
          })
        : op === "discourse"
        ? await deriveNodeAttribute({
            uid,
            attribute: args[0],
          })
        : op === "sum"
        ? await getRelatedResults({
            uid,
            nodes,
            relations,
            relationLabel: args[0],
            target: args[1],
          })
            .then((results) =>
              Promise.all(
                results.map((r) =>
                  deriveNodeAttribute({ attribute: args[2], uid: r.uid })
                )
              )
            )
            .then((values) =>
              values.map((v) => Number(v) || 0).reduce((p, c) => p + c, 0)
            )
        : op === "average"
        ? await getRelatedResults({
            uid,
            nodes,
            relations,
            relationLabel: args[0],
            target: args[1],
          })
            .then((results) =>
              Promise.all(
                results.map((r) =>
                  deriveNodeAttribute({ attribute: args[2], uid: r.uid })
                )
              )
            )
            .then(
              (values) =>
                values.map((v) => Number(v) || 0).reduce((p, c) => p + c, 0) /
                values.length
            )
        : "0";
    const postOp = `${postProcess.slice(
      0,
      match.index + totalOffset
    )}${value}${postProcess.slice(
      match.index + match[0].length + totalOffset
    )}`;
    totalOffset = totalOffset + postOp.length - postProcess.length;
    postProcess = postOp;
  }
  try {
    return evaluate(postProcess);
  } catch {
    return postProcess;
  }
};

export default deriveNodeAttribute;
