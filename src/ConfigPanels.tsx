import {
  Button,
  H6,
  InputGroup,
  Intent,
  Label,
  Menu,
  MenuItem,
  Tab,
  Tabs,
} from "@blueprintjs/core";
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
import { englishToDatalog } from "./util";

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

const DEFAULT_SELECTED_RELATION = {
  display: "none",
  top: 0,
  left: 0,
  relation: "references",
  id: "",
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
  const blockClickRef = useRef(false);
  const clearEditingRef = useCallback(() => {
    if (editingRef.current) {
      editingRef.current.style("border-width", 0);
      editingRef.current.unlock();
      editingRef.current = null;
    }
  }, [editingRef]);
  const clearSourceRef = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.style("background-color", "#888888");
      sourceRef.current.unlock();
      sourceRef.current = null;
    }
  }, [sourceRef]);
  const [selectedRelation, setSelectedRelation] = useState(
    DEFAULT_SELECTED_RELATION
  );
  const [tab, setTab] = useState(0);
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
  const edgeCallback = useCallback(
    (edge: cytoscape.EdgeSingular) => {
      edge.on("click", (e) => {
        if (blockClickRef.current) {
          return;
        }
        e.stopPropagation();
        clearEditingRef();
        clearSourceRef();
        if (e.originalEvent.ctrlKey) {
          cyRef.current.remove(edge);
        } else {
          setSelectedRelation({
            display: "block",
            top: e.position.y,
            left: e.position.x,
            relation: edge.data("relation"),
            id: edge.id(),
          });
        }
      });
    },
    [clearSourceRef, clearEditingRef, setSelectedRelation, cyRef, blockClickRef]
  );
  const nodeCallback = useCallback(
    (n: cytoscape.NodeSingular) => {
      n.on("click", (e) => {
        if (blockClickRef.current) {
          return;
        }
        e.stopPropagation();
        setSelectedRelation(DEFAULT_SELECTED_RELATION);
        if (e.originalEvent.ctrlKey) {
          clearSourceRef();
          clearEditingRef();
          cyRef.current.remove(n);
        } else if (e.originalEvent.shiftKey) {
          clearEditingRef();
          if (sourceRef.current) {
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
            clearSourceRef();
          } else {
            n.style("background-color", "#000000");
            n.lock();
            sourceRef.current = n;
          }
        } else {
          clearSourceRef();
          if (editingRef.current) {
            clearEditingRef();
          } else if (!["source", "destination"].includes(n.id())) {
            editingRef.current = n;
            editingRef.current.lock();
            containerRef.current.focus();
            n.style("border-width", 4);
          }
        }
      });
    },
    [
      sourceRef,
      cyRef,
      edgeCallback,
      editingRef,
      containerRef,
      clearEditingRef,
      clearSourceRef,
      blockClickRef,
    ]
  );
  const ifTree = useMemo(
    () =>
      editingRelationInfo.children.find((t) => toFlexRegex("if").test(t.text))
        ?.children || [],
    [editingRelationInfo]
  );
  const initialElements = useMemo(
    () =>
      ifTree.map((andTree) => {
        const { nodes, edges } = andTree.children.reduce(
          ({ nodes, edges }, node) => {
            const source = node.text;
            nodes.add(source);
            const target = node.children[0]?.children?.[0]?.text || "";
            nodes.add(target);
            edges.add({
              source,
              target,
              relation: (node.children[0]?.text || "").toLowerCase(),
            });
            return { nodes, edges };
          },
          {
            nodes: new Set([initialSource, initialDestination]),
            edges: new Set<{
              source: string;
              target: string;
              relation: string;
            }>(),
          }
        );
        const elementNodes = Array.from(nodes).map((node, i, all) => ({
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
            x: Math.sin((2 * Math.PI * i) / all.length) * 150 + 200,
            y: Math.cos((2 * Math.PI * i) / all.length) * 150 + 200,
          },
        }));
        return [
          ...elementNodes,
          ...Array.from(edges).map(({ source, target, relation }) => {
            const sourceId = elementNodes.find((n) => n.data.node === source)
              ?.data?.id;
            const targetId = elementNodes.find((n) => n.data.node === target)
              ?.data?.id;
            return {
              data: {
                id: `${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                relation,
              },
            };
          }),
        ];
      }),
    [ifTree, initialDestination, initialSource]
  );
  const elementsRef = useRef(initialElements);
  const saveCyToElementRef = useCallback(
    (t) => {
      const nodes = cyRef.current.nodes();
      const edges = cyRef.current.edges();
      elementsRef.current[t] = [
        ...nodes.map((n) => ({ data: n.data(), position: n.position() })),
        ...edges.map((n) => ({ data: n.data() })),
      ];
    },
    [cyRef, elementsRef]
  );
  const [tabs, setTabs] = useState(initialElements.map((_, i) => i));

  useEffect(() => {
    cyRef.current?.destroy?.();
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: elementsRef.current[tab],
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
            "text-max-width": "54",
            width: 60,
            height: 60,
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
      if (blockClickRef.current) {
        return;
      }
      const { position } = e;
      const id = (idRef.current++).toString();
      const node = cyRef.current.add({
        data: { id, node: `Block${id}` },
        position,
      });
      nodeCallback(node);
      clearEditingRef();
      clearSourceRef();
      setSelectedRelation(DEFAULT_SELECTED_RELATION);
    });
    cyRef.current.nodes().forEach(nodeCallback);
    cyRef.current.edges().forEach(edgeCallback);
  }, [
    cyRef,
    containerRef,
    elementsRef,
    idRef,
    blockClickRef,
    nodeCallback,
    edgeCallback,
    setSelectedRelation,
    tab,
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
      <div>
        <Tabs
          selectedTabId={tab}
          onChange={(id) => {
            saveCyToElementRef(tab);
            setTab(id as number);
          }}
        >
          {tabs.map((i) => (
            <Tab key={i} id={i} title={i} />
          ))}
          <Button
            icon={"plus"}
            minimal
            onClick={() => {
              const newId = tabs.slice(-1)[0];
              saveCyToElementRef(tab);
              elementsRef.current.push([
                {
                  data: { id: "source", node: initialSource },
                  position: {
                    x: 200,
                    y: 50,
                  },
                },
                {
                  data: { id: "destination", node: initialDestination },
                  position: {
                    x: 200,
                    y: 350,
                  },
                },
              ]);
              setTabs([...tabs, newId]);
              setTab(newId);
            }}
          />
        </Tabs>
      </div>
      <div className={"roamjs-discourse-edit-relations"}>
        <div
          tabIndex={-1}
          ref={containerRef}
          style={{ height: "100%" }}
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
        <Menu
          style={{
            position: "absolute",
            ...selectedRelation,
            zIndex: 1,
            background: "#eeeeee",
          }}
        >
          {Object.keys(englishToDatalog)
            .filter((k) => k !== selectedRelation.relation)
            .map((k) => (
              <MenuItem
                key={k}
                text={k}
                onMouseDown={() => (blockClickRef.current = true)}
                onClick={(e: React.MouseEvent) => {
                  blockClickRef.current = false;
                  (
                    cyRef.current.edges(
                      `#${selectedRelation.id}`
                    ) as cytoscape.EdgeSingular
                  ).data("relation", k);
                  setSelectedRelation(DEFAULT_SELECTED_RELATION);
                  e.stopPropagation();
                }}
              />
            ))}
        </Menu>
        {tabs.length > 1 && (
          <Button
            minimal
            icon={"trash"}
            onClick={() => {
              const newTabs = tabs.filter((t) => t != tab);
              setTabs(newTabs);
              setTab(newTabs[0]);
            }}
            style={{ zIndex: 1, position: "absolute", top: 8, right: 8 }}
          />
        )}
      </div>
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
          saveCyToElementRef(tab);
          const blocks = tabs
            .map((t) => elementsRef.current[t])
            .map((elements) => ({
              text: "And",
              children: elements
                .filter((e) => e.data.id.includes("-"))
                .map((e) => {
                  const { source, target, relation } = e.data as {
                    source: string;
                    target: string;
                    relation: string;
                  };
                  return {
                    text: (
                      elements.find((e) => e.data.id === source)?.data as {
                        node: string;
                      }
                    )?.node,
                    children: [
                      {
                        text: relation,
                        children: [
                          {
                            text: (
                              elements.find((e) => e.data.id === target)
                                ?.data as { node: string }
                            )?.node,
                          },
                        ],
                      },
                    ],
                  };
                }),
            }));
          getShallowTreeByParentUid(ifUid).forEach(({ uid }) =>
            deleteBlock(uid)
          );
          blocks.forEach((block, order) =>
            createBlock({ parentUid: ifUid, node: block, order })
          );
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
