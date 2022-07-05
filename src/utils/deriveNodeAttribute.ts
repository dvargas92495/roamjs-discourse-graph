import { evaluate } from "mathjs";
import getSubTree from "roamjs-components/util/getSubTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import {
  ANY_REGEX,
  getDiscourseContextResults,
  getNodes,
  matchNode,
} from "../util";
import getAttributeValueByBlockAndName from "roamjs-components/queries/getAttributeValueByBlockAndName";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

const deriveNodeAttribute = ({
  attribute,
  title,
  results,
}: {
  attribute: string;
  title: string;
  results: Awaited<ReturnType<typeof getDiscourseContextResults>>;
}): string | number => {
  const nodeType = getNodes().find((n) =>
    matchNode({ format: n.format, title })
  )?.type;
  if (!nodeType)
    return results.flatMap((r) => Object.entries(r.results)).length;
  const attributeNode = getSubTree({
    tree: getBasicTreeByParentUid(nodeType),
    key: "Attributes",
  });
  const scoreFormula = getSettingValueFromTree({
    tree: attributeNode.children,
    key: attribute,
    defaultValue: "{count:Has Any Relation To:any}",
  });
  const postProcess = scoreFormula.replace(/{([^}]+)}/g, (_, interpolation:string) => {
    const [op, ...args] = interpolation.split(":");
    if (op === "count") {
      return results
        .filter((r) => ANY_REGEX.test(args[0]) || args[0] === r.label)
        .flatMap((r) => Object.values(r.results))
        .filter((r) => /any/i.test(args[1]) || r.target === args[1])
        .length.toString();
    } else if (op === "attribute") {
      return getAttributeValueByBlockAndName({
        name: args[0],
        uid: getPageUidByPageTitle(title),
      });
    } else if (op === "discourse") {
      return deriveNodeAttribute({
        title,
        results,
        attribute: args[0]
      }).toString();
    } else {
      console.warn(`Unknown op: ${op}`);
      return "0";
    }
  });
  try {
    return evaluate(postProcess);
  } catch {
    return postProcess;
  }
};

export default deriveNodeAttribute;
