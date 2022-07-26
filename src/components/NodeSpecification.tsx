import React from "react";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import { getNodeFormatExpression, getNodes } from "../util";
import { Switch } from "@blueprintjs/core";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";

const NodeSpecification = ({
  parentUid,
  node,
}: {
  parentUid: string;
  node: ReturnType<typeof getNodes>[number];
}) => {
  const [migrated, setMigrated] = React.useState(false);
  const [enabled, setEnabled] = React.useState(
    () =>
      getSubTree({ tree: getBasicTreeByParentUid(parentUid), key: "enabled" })
        ?.uid
  );
  const { QueryEditor } = window.roamjs.extension.queryBuilder;
  React.useEffect(() => {
    if (enabled) {
      const scratchNode = getSubTree({ parentUid, key: "scratch" });
      if (
        !scratchNode.children.length ||
        !getSubTree({ tree: scratchNode.children, key: "conditions" }).children
          .length
      ) {
        const conditionsUid = getSubTree({
          parentUid: scratchNode.uid,
          key: "conditions",
        }).uid;
        createBlock({
          parentUid: conditionsUid,
          node: {
            text: "clause",
            children: [
              { text: "source", children: [{ text: node.text }] },
              { text: "relation", children: [{ text: "has title" }] },
              {
                text: "destination",
                children: [
                  { text: `/${getNodeFormatExpression(node.format).source}/` },
                ],
              },
            ],
          },
        }).then(() => setMigrated(true));
      }
    }
  }, [parentUid, setMigrated, enabled]);
  return (
    <div className={"roamjs-node-specification"}>
      <style>
        {`.roamjs-node-specification .bp3-button.bp3-intent-primary { display: none; }`}
      </style>
      <p>
        WARNING: This feature is under development, and intends to replace the
        format setting in the future. Enabling will replace how Nodes are
        identified with this specification.{" "}
        <Switch
          checked={!!enabled}
          className={"inline-block ml-8"}
          onChange={(e) => {
            const flag = (e.target as HTMLInputElement).checked;
            if (flag) {
              createBlock({
                parentUid,
                order: 2,
                node: { text: "enabled" },
              }).then(setEnabled);
            } else {
              deleteBlock(enabled).then(() => setEnabled(""));
            }
          }}
        />
      </p>
      <div className={enabled ? "" : "bg-gray-200 opacity-75"}>
        <QueryEditor
          parentUid={parentUid}
          key={Number(migrated)}
          defaultReturnNode={"page"}
        />
      </div>
    </div>
  );
};

export default NodeSpecification;
