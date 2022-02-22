import React, { useMemo } from "react";
import { englishToDatalog, getNodes } from "../util";
import ResultsView from "./ResultsView";

const NodeIndex = ({
  node,
  allNodes,
}: {
  node: ReturnType<typeof getNodes>[number];
  allNodes: ReturnType<typeof getNodes>;
}) => {
  const results = useMemo(
    () =>
      window.roamAlphaAPI
        .q(
          `[:find (pull ?${node.text} [
[:node/title :as "text"] 
:block/uid
[:create/time :as "createdTime"]
[:edit/time :as "editedTime"]
]) :where ${englishToDatalog(allNodes)["is a"](node.text, node.type)}]`
        )
        .map(
          (a) => 
            a[0] as {
              text: string;
              uid: string;
              createdTime: number;
              editedTime: number;
            }
        ).map(a => ({
          ...a,
          createdTime: new Date(a.createdTime),
          editedTime: new Date(a.editedTime),
        })),
    [node, allNodes]
  );
  return <ResultsView results={results} />;
};

export default NodeIndex;
