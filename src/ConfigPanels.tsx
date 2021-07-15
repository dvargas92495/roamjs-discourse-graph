import { Button, H6, InputGroup } from "@blueprintjs/core";
import React, { useState } from "react";
import {
  createBlock,
  deleteBlock,
  getShallowTreeByParentUid,
} from "roam-client";

type Panel = (props: { uid: string; parentUid: string }) => React.ReactElement;

export const NodeConfigPanel: Panel = ({ uid, parentUid }) => {
  const [nodes, setNodes] = useState(uid ? getShallowTreeByParentUid(uid) : []);
  const [node, setNode] = useState("");
  const [label, setLabel] = useState("");
  const [shortcut, setShortcut] = useState("");
  return (
    <>
      <div style={{ display: "flex", marginBottom: 8 }}>
        <InputGroup
          value={node}
          onChange={(e) => setNode(e.target.value)}
          placeholder={"Enter Node"}
          style={{ maxWidth: 100 }}
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
          style={{ maxWidth: 50 }}
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
      <ul style={{ listStyle: "none", paddingInlineStart: 16 }}>
        {nodes.map((n) => {
          const data = getShallowTreeByParentUid(n.uid);
          const [{ text: label }, { text: shortcut }] = data;
          return (
            <li key={n.uid} style={{ border: "1px dashed #80808080" }}>
              <H6 style={{ margin: 0 }}>{n.text}</H6>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ display: "inline-block", minWidth: 200 }}>
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
                  style={{ minWidth: 30 }}
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
