import React from "react";
import { getNodes } from "../util";

const NodeIndex = ({
  parentUid,
  node,
}: {
  parentUid: string;
  node: ReturnType<typeof getNodes>[number];
}) => {
  const { QueryPage } = window.roamjs.extension.queryBuilder;
  return <QueryPage pageUid={parentUid} defaultReturnNode={node.text} />;
};

export default NodeIndex;
