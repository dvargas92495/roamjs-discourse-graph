import { Button, H6, InputGroup, Intent, Label } from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import {
  createBlock,
  deleteBlock,
  getConfigFromPage,
  getShallowTreeByParentUid,
  getTreeByBlockUid,
  getTreeByPageName,
  TreeNode,
} from "roam-client";
import {
  getSettingValueFromTree,
  MenuItemSelect,
  setInputSetting,
  toFlexRegex,
} from "roamjs-components";

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
          placeholder={"Node"}
          style={{ maxWidth: 100 }}
        />
        <InputGroup
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={"Label"}
          className={"roamjs-discourse-config-label"}
        />
        <InputGroup
          value={shortcut}
          onChange={(e) => setShortcut(e.target.value)}
          placeholder={"Shortcut"}
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
      <ul
        style={{
          listStyle: "none",
          paddingInlineStart: 0,
        }}
      >
        {nodes.map((n) => {
          const data = getShallowTreeByParentUid(n.uid);
          const [{ text: label }, { text: shortcut }] = data;
          return (
            <li
              key={n.uid}
              style={{ border: "1px dashed #80808080", padding: 4 }}
            >
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

const RelationEditPanel = ({
  editingRelationInfo,
  back,
}: {
  editingRelationInfo: TreeNode;
  back: () => void;
}) => {
  const nodes = useMemo(
    () =>
      (
        (
          getTreeByPageName("roam/js/discourse-graph").find((t) =>
            toFlexRegex("grammar").test(t.text)
          )?.children || []
        ).find((t) => toFlexRegex("nodes").test(t.text))?.children || []
      ).map((n) => n.text),
    []
  );
  const [source, setSource] = useState(
    getSettingValueFromTree({
      tree: editingRelationInfo.children,
      key: "source",
    })
  );
  const [destination, setDestination] = useState(
    getSettingValueFromTree({
      tree: editingRelationInfo.children,
      key: "destination",
    })
  );
  const [complement, setComplement] = useState(
    getSettingValueFromTree({
      tree: editingRelationInfo.children,
      key: "complement",
    })
  );
  return (
    <>
      <h3
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {editingRelationInfo.text}
        <Button icon={"arrow-left"} minimal onClick={back} />
      </h3>
      <div style={{ display: "flex" }}>
        <Label style={{ flexGrow: 1 }}>
          Source
          <MenuItemSelect
            activeItem={source}
            onItemSelect={(e) => setSource(e)}
            items={nodes}
          />
        </Label>
        <Label style={{ flexGrow: 1 }}>
          Destination
          <MenuItemSelect
            activeItem={destination}
            onItemSelect={(e) => setDestination(e)}
            items={nodes}
          />
        </Label>
        <Label style={{ flexGrow: 1 }}>
          Complement
          <InputGroup
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
          />
        </Label>
      </div>
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
          const rootUid = editingRelationInfo.uid;
          setInputSetting({ blockUid: rootUid, key: "source", value: source });
          setInputSetting({
            blockUid: rootUid,
            key: "destination",
            value: destination,
            index: 1,
          });
          setInputSetting({
            blockUid: rootUid,
            key: "complement",
            value: complement,
            index: 2,
          });
          const ifUid =
            editingRelationInfo.children.find((t) =>
              toFlexRegex("if").test(t.text)
            )?.uid ||
            createBlock({ node: { text: "If" }, parentUid: rootUid, order: 3 });
          back();
        }}
      />
    </>
  );
};

export const RelationConfigPanel: Panel = ({ uid }) => {
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
    <RelationEditPanel
      editingRelationInfo={editingRelationInfo}
      back={() => setEditingRelation("")}
    />
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
