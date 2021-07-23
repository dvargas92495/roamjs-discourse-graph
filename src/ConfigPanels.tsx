import { Button, H6, InputGroup, Intent } from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import {
  createBlock,
  deleteBlock,
  getShallowTreeByParentUid,
  getTreeByBlockUid,
} from "roam-client";

type Panel = (props: { uid: string; parentUid: string }) => React.ReactElement;

export const NodeConfigPanel: Panel = ({ uid }) => {
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
  const [relations, setRelations] = useState(
    uid ? getShallowTreeByParentUid(uid) : []
  );
  const [editingRelation, setEditingRelation] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const editingRelationInfo = useMemo(
    () => editingRelation && getTreeByBlockUid(editingRelation),
    [editingRelation]
  );
  return editingRelation ? (
    <>
      <h3
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {editingRelationInfo.text}
        <Button
          icon={"arrow-left"}
          minimal
          onClick={() => setEditingRelation("")}
        />
      </h3>
      <div
        style={{
          border: "1px solid gray",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          textAlign: "center",
          height: 400,
          width: "100%",
        }}
      >
        Editing UI Coming Soon...
      </div>
      <Button
        text={"Save"}
        intent={Intent.PRIMARY}
        style={{ marginTop: 10 }}
        onClick={() => {
          setEditingRelation("");
        }}
      />
    </>
  ) : (
    <>
      <div>
        <div style={{ display: "flex" }}>
          <InputGroup
            value={newRelation}
            onChange={(e) => setNewRelation(e.target.value)}
          />
          <Button
            onClick={() => {
              const relationUid = createBlock({
                parentUid: uid,
                order: relations.length,
                node: { text: newRelation },
              });
              setTimeout(() => {
                setRelations([
                  ...relations,
                  { text: newRelation, uid: relationUid },
                ]);
                setNewRelation("");
                setEditingRelation(relationUid);
              }, 1);
            }}
            text={"Add Relation"}
            style={{ maxWidth: 120, marginLeft: 8 }}
            intent={Intent.PRIMARY}
          />
        </div>
      </div>
      <ul style={{ listStyle: "none", paddingInlineStart: 16 }}>
        {relations.map((rel) => (
          <li key={rel.uid}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{rel.text}</span>
              <span>
                <Button
                  icon={"edit"}
                  minimal
                  onClick={() => {
                    setEditingRelation(rel.uid);
                  }}
                />
                <Button
                  icon={"delete"}
                  minimal
                  onClick={() => {
                    deleteBlock(rel.uid);
                    setRelations(relations.filter((r) => r.uid !== rel.uid));
                  }}
                />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};
