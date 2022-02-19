import React, { useMemo } from "react";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { englishToDatalog, getNodes } from "../util";

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
:node/title 
:block/uid
]) :where ${englishToDatalog(allNodes)["is a"](node.text, node.type)}]`
        )
        .map((a) => a[0] as { title: string; uid: string }),
    [node, allNodes]
  );
  return (
    <div>
      {results.map((r) => (
        <div key={r.uid}>
          <a
            onClick={(e) =>
              e.shiftKey
                ? openBlockInSidebar(r.uid)
                : window.roamAlphaAPI.ui.mainWindow.openPage({
                    page: { uid: r.uid },
                  })
            }
          >
            {r.title}
          </a>
        </div>
      ))}
    </div>
  );
};

export default NodeIndex;
