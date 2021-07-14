import { Button, H6, InputGroup } from "@blueprintjs/core";
import React, { useState } from "react";
import {
  createBlock,
  deleteBlock,
  getShallowTreeByParentUid,
  getTreeByBlockUid,
} from "roam-client";

type Panel = (props: { uid: string; parentUid: string }) => React.ReactElement;

export const NodeConfigPanel: Panel = ({ uid, parentUid }) => {
  const [nodes, setNodes] = useState(uid ? getShallowTreeByParentUid(uid) : []);
  const [node, setNode] = useState("");
  const [label, setLabel] = useState("");
  const [shortcut, setShortcut] = useState("");
  return (
    <>
      <div style={{ display: "flex" }}>
        <InputGroup
          value={node}
          onChange={(e) => setNode(e.target.value)}
          placeholder={"Enter Node"}
        />
        <InputGroup
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={"Enter Label"}
        />
        <InputGroup
          value={shortcut}
          onChange={(e) => setShortcut(e.target.value)}
          placeholder={"Enter Shortcut"}
        />
        <Button
          icon={"plus"}
          minimal
          disabled={!node || !shortcut || !label}
          onClick={() => {
            const valueUid = createBlock({
              parentUid: uid,
              order: nodes.length,
              node: {
                text: node,
                children: [{ text: label }, { text: shortcut }],
              },
            });
            setNodes([...nodes, { text: node, uid: valueUid }]);
            setNode("");
            setLabel("");
            setShortcut("");
          }}
        />
      </div>
      <ul style={{ listStyle: "none" }}>
        {nodes.map((n) => {
          const data = getShallowTreeByParentUid(n.uid);
          const [{ text: label }, { text: shortcut }] = data;
          return (
            <li key={n.uid}>
              <H6 style={{ margin: 0 }}>{n.text}</H6>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-around",
                  alignItems: "center",
                }}
              >
                <span>
                  <b>Label: </b> {label}
                </span>
                <span>
                  <b>Shortcut: </b> {shortcut}
                </span>
                <Button
                  icon={"trash"}
                  onClick={() => {
                    setNodes(nodes.filter((nn) => nn.uid !== n.uid));
                    deleteBlock(n.uid);
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export const RelationConfigPanel: Panel = ({ uid, parentUid }) => {
  return <ul></ul>;
};
