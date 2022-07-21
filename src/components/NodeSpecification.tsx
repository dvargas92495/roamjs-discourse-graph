import React from "react";
import { getNodes } from "../util";

const NodeSpecification = ({
  parentUid,
  node,
}: {
  parentUid: string;
  node: ReturnType<typeof getNodes>[number];
}) => {
  const { QueryEditor } = window.roamjs.extension.queryBuilder;
  return (
    <div className={"roamjs-node-specification"}>
      <style>
        {`.roamjs-node-specification .bp3-button.bp3-intent-primary { display: none; }`}
      </style>
      <p>
        WARNING: This feature is under development, and intends to replace the
        format setting in the future
      </p>
      <QueryEditor parentUid={parentUid} />
    </div>
  );
};

export default NodeSpecification;
