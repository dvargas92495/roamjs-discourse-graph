import { Button, H6, InputGroup, Intent, Label } from "@blueprintjs/core";
import cytoscape, { NodeSingular } from "cytoscape";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createBlock,
  deleteBlock,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const cyRef = useRef<cytoscape.Core>(null);
  const sourceRef = useRef<cytoscape.NodeSingular>(null);
  const editingRef = useRef<cytoscape.NodeSingular>(null);
  const clearEditingRef = useCallback(() => {
    editingRef.current.style("border-width", 0);
    editingRef.current.unlock();
    editingRef.current = null;
  }, [editingRef]);
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
  const initialSource = useMemo(
    () =>
      getSettingValueFromTree({
        tree: editingRelationInfo.children,
        key: "source",
      }),
    []
  );
  const [source, setSource] = useState(initialSource);
  const initialDestination = useMemo(
    () =>
      getSettingValueFromTree({
        tree: editingRelationInfo.children,
        key: "destination",
      }),
    []
  );
  const [destination, setDestination] = useState(initialDestination);
  const [complement, setComplement] = useState(
    getSettingValueFromTree({
      tree: editingRelationInfo.children,
      key: "complement",
    })
  );
  const edgeCallback = useCallback((edge: cytoscape.EdgeSingular) => {
    edge.on("click", (e) => {
      e.stopPropagation();
    });
  }, []);
  const nodeCallback = useCallback(
    (n: cytoscape.NodeSingular) => {
      n.on("click", (e) => {
        e.stopPropagation();
        if (e.originalEvent.shiftKey) {
          if (sourceRef.current) {
            sourceRef.current.style("background-color", "#888888");
            sourceRef.current.unlock();
            sourceRef.current = null;
          }
          if (editingRef.current) {
            clearEditingRef();
          } else if (!["source", "destination"].includes(n.id())) {
            editingRef.current = n;
            editingRef.current.lock();
            containerRef.current.focus();
            n.style("border-width", 4);
          }
        } else if (sourceRef.current) {
          const source = sourceRef.current.id();
          const target = n.id();
          if (source !== target) {
            const data = {
              id: `${source}-${target}`,
              source,
              target,
              relation: "references",
            };
            if (
              cyRef.current
                .edges()
                .every((e: cytoscape.EdgeSingular) => e.id() !== data.id)
            ) {
              const edge = cyRef.current.add({ data })[0];
              edgeCallback(edge);
            }
          }
          sourceRef.current.style("background-color", "#888888");
          sourceRef.current.unlock();
          sourceRef.current = null;
        } else {
          n.style("background-color", "#000000");
          n.lock();
          sourceRef.current = n;
        }
        if (editingRef.current && !e.originalEvent.shiftKey) {
          clearEditingRef();
        }
      });
    },
    [sourceRef, cyRef, edgeCallback, editingRef, containerRef, clearEditingRef]
  );
  useEffect(() => {
    const nodes = new Set([initialDestination, initialSource]);
    const ifTree =
      editingRelationInfo.children.find((t) => toFlexRegex("if").test(t.text))
        ?.children || [];
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...Array.from(nodes).map((node) => ({
          data: {
            id:
              node === initialSource
                ? "source"
                : node === initialDestination
                ? "destination"
                : (idRef.current++).toString(),
            node,
          },
          position: {
            x: Math.random() * 300 + 50,
            y: Math.random() * 300 + 50,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#888888",
            label: "data(node)",
            shape: "round-rectangle",
            color: "#ffffff",
            "text-wrap": "wrap",
            "text-halign": "center",
            "text-valign": "center",
            "text-max-width": "40",
            width: 40,
            height: 40,
            "font-size": 12,
            "border-color": "black",
          },
        },
        {
          selector: "edge",
          style: {
            width: 10,
            "line-color": "#ccc",
            "target-arrow-color": "#ccc",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(relation)",
          },
        },
      ],

      layout: {
        name: "preset",
        padding: 40,
      },
      zoomingEnabled: false,
      userZoomingEnabled: false,
      panningEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
    });
    cyRef.current.on("click", (e) => {
      const { position } = e;
      const id = (idRef.current++).toString();
      const node = cyRef.current.add({
        data: { id, node: `Block${id}` },
        position,
      });
      nodeCallback(node);
    });
    cyRef.current.nodes().forEach(nodeCallback);
    cyRef.current.edges().forEach(edgeCallback);
  }, [
    cyRef,
    containerRef,
    editingRelationInfo,
    idRef,
    nodeCallback,
    edgeCallback,
  ]);
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
            onItemSelect={(e) => {
              setSource(e);
              (cyRef.current.nodes("#source") as NodeSingular).data("node", e);
            }}
            items={nodes}
          />
        </Label>
        <Label style={{ flexGrow: 1 }}>
          Destination
          <MenuItemSelect
            activeItem={destination}
            onItemSelect={(e) => {
              setDestination(e);
              (cyRef.current.nodes("#destination") as NodeSingular).data(
                "node",
                e
              );
            }}
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
          height: 400,
          width: "100%",
          outline: "none",
        }}
        tabIndex={-1}
        ref={containerRef}
        onKeyDown={(e) => {
          if (editingRef.current) {
            if (e.key === "Enter") {
              editingRef.current.style("border-width", 0);
              editingRef.current.unlock();
              editingRef.current = null;
            } else if (e.key === "Backspace") {
              editingRef.current.data(
                "node",
                editingRef.current.data("node").slice(0, -1)
              );
            } else if (/\w/.test(e.key) && e.key.length === 1) {
              editingRef.current.data(
                "node",
                `${editingRef.current.data("node")}${e.key}`
              );
            }
          }
        }}
      />
      <Button
        text={"Save"}
        intent={Intent.PRIMARY}
        style={{ marginTop: 10 }}
        onClick={() => {
          const rootUid = editingRelationInfo.uid;
          setInputSetting({
            blockUid: rootUid,
            key: "source",
            value: source,
          });
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
            createBlock({
              node: { text: "If" },
              parentUid: rootUid,
              order: 3,
            });
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
