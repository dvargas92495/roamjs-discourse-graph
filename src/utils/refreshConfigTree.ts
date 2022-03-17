import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageTitlesStartingWithPrefix from "roamjs-components/queries/getPageTitlesStartingWithPrefix";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { getRelationLabels } from "../util";
import treeRef from "./configTreeRef";
import registerDatalogTranslators from "./registerDatalogTranslators";

const refreshConfigTree = () => {
  if (window.roamjs.extension.queryBuilder) {
    const { unregisterDatalogTranslator } = window.roamjs.extension.queryBuilder;
    getRelationLabels().forEach((key) => unregisterDatalogTranslator({ key }));
  }
  treeRef.tree = getBasicTreeByParentUid(
    getPageUidByPageTitle("roam/js/discourse-graph")
  );
  const titles = getPageTitlesStartingWithPrefix("discourse-graph/nodes");
  treeRef.nodes = Object.fromEntries(
    titles.map((title) => {
      const uid = getPageUidByPageTitle(title);
      return [
        uid,
        {
          text: title.substring("discourse-graph/nodes/".length),
          children: getBasicTreeByParentUid(uid),
        },
      ];
    })
  );
  if (window.roamjs.extension.queryBuilder) registerDatalogTranslators();
};

export default refreshConfigTree;
