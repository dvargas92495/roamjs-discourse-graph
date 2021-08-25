import {
  Alert,
  Button,
  H6,
  InputGroup,
  Intent,
  Label,
  Menu,
  MenuItem,
  Spinner,
  SpinnerSize,
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
  getFirstChildTextByBlockUid,
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
import { englishToDatalog, Panel } from "./util";

export const NodeConfigPanel: Panel = ({ uid }) => {
  const [nodes, setNodes] = useState(() =>
    uid ? getShallowTreeByParentUid(uid) : []
  );
  const [node, setNode] = useState("");
  const [label, setLabel] = useState("");
  const [shortcut, setShortcut] = useState("");
  return (
    <>
      <div style={{ display: "flex", marginBottom: 8 }}>
        <InputGroup
          value={node}
          onChange={(e) => setNode(e.target.value.slice(0, 3).toUpperCase())}
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
          onChange={(e) => setShortcut(e.target.value.slice(-1).toUpperCase())}
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
            setTimeout(() => {
              setNodes([...nodes, { text: node, uid: valueUid }]);
              setNode("");
              setLabel("");
              setShortcut("");
            }, 1);
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

type Triple = { source: string; target: string; relation: string };

const RelationEditPreview = ({ elements }: { elements: Triple[] }) => {
  const relationToTitle = (source: string) => {
    const rel = elements.find(
      (h) =>
        h.source === source &&
        [/is a/i, /has title/i].some((r) => r.test(h.relation))
    ) || {
      relation: "",
      target: "",
    };
    return /is a/i.test(rel.relation)
      ? `[[${rel.target}]] - This is a ${rel.target} page.`
      : /has title/i.test(rel.relation)
      ? rel.target
      : source;
  };
  const Block = (b: { source: string }) => (
    <div className={"roam-block-container"}>
      <div className={"rm-block-main"}>
        <div className="controls rm-block__controls">
          <span className="block-expand">
            <span className="bp3-icon-standard bp3-icon-caret-down rm-caret rm-caret-open rm-caret-hidden"></span>
          </span>
          <span className="rm-bullet">
            <span
              className="rm-bullet__inner--user-icon"
              tabIndex={0}
              style={{ backgroundColor: "#202B33" }}
            ></span>
          </span>
        </div>
        <div className={"roam-block"}>
          <span>
            {elements
              .filter(
                (e) => /with text/i.test(e.relation) && e.source === b.source
              )
              .map((e, i) => (
                <span key={`with-text-${i}`}>
                  <span>
                    {i > 0 && " "}
                    {e.target}
                  </span>
                </span>
              ))}
            {elements
              .filter(
                (e) => /references/i.test(e.relation) && e.source === b.source
              )
              .map((e, i) => (
                <span key={`references-${i}`}>
                  <span> </span>
                  <span className="rm-page-ref__brackets">[[</span>
                  <span className={"rm-page-ref--link"}>
                    {relationToTitle(e.target)}
                  </span>
                  <span className="rm-page-ref__brackets">]]</span>
                </span>
              ))}
          </span>
        </div>
      </div>
      <div className={"rm-block-children"}>
        <div className="rm-multibar"></div>
        {elements
          .filter((c) => /has child/i.test(c.relation) && c.source === b.source)
          .map((c, i) => (
            <Block source={c.target} key={i} />
          ))}
        {elements
          .filter(
            (c) => /has parent/i.test(c.relation) && c.target === b.source
          )
          .map((c, i) => (
            <Block source={c.source} key={i} />
          ))}
      </div>
    </div>
  );
  const Page = ({ title, blocks }: { title: string; blocks: string[] }) => (
    <div
      style={{
        width: 256,
        height: 320,
        borderRadius: 4,
        border: "1px solid #cccccc",
        margin: "0 8px",
        padding: 8,
      }}
    >
      <span
        style={{
          display: "block",
          color: "#202B33",
          marginBottom: 12,
          fontWeight: 450,
          fontSize: 24,
        }}
      >
        {title}
      </span>
      {blocks.map((b, i) => (
        <Block source={b} key={i} />
      ))}
    </div>
  );
  const pageElements = elements.filter((e) => /is in page/i.test(e.relation));
  const pages = pageElements.reduce(
    (prev, cur) => ({
      ...prev,
      [cur.target]: [...(prev[cur.target] || []), cur.source],
    }),
    {} as Record<string, string[]>
  );
  return (
    <div style={{ padding: "32px 24px" }}>
      {pageElements.length ? (
        Object.entries(pages).map((p, i) => (
          <Page key={i} title={relationToTitle(p[0])} blocks={p[1]} />
        ))
      ) : (
        <Page
          title={"Any Page"}
          blocks={Array.from(
            elements.reduce(
              (prev, cur) => {
                if (
                  [/has child/i, /references/i, /with text/i].some((r) =>
                    r.test(cur.relation)
                  )
                ) {
                  if (!prev.leaves.has(cur.source)) {
                    prev.roots.add(cur.source);
                  }
                  prev.leaves.add(cur.target);
                  prev.roots.delete(cur.target);
                } else if (/has parent/i.test(cur.relation)) {
                  if (!prev.leaves.has(cur.target)) {
                    prev.roots.add(cur.target);
                  }
                  prev.leaves.add(cur.source);
                  prev.roots.delete(cur.source);
                }
                return prev;
              },
              { roots: new Set<string>(), leaves: new Set<string>() }
            ).roots
          )}
        />
      )}
    </div>
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
  const blockClickRef = useRef(false);
  const showBackWarning = useRef(false);
  const unsavedChanges = useCallback(
    () => (showBackWarning.current = true),
    [showBackWarning]
  );
  const [backWarningOpen, setBackWarningOpen] = useState(false);
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
          unsavedChanges();
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
    [
      clearSourceRef,
      clearEditingRef,
      setSelectedRelation,
      cyRef,
      blockClickRef,
      unsavedChanges,
    ]
  );
  const nodeCallback = useCallback(
    (n: cytoscape.NodeSingular) => {
      n.on("click", (e) => {
        if (blockClickRef.current) {
          return;
        }
        e.stopPropagation();
        setSelectedRelation(DEFAULT_SELECTED_RELATION);
        if (
          e.originalEvent.ctrlKey &&
          !["source", "destination"].includes(n.id())
        ) {
          clearSourceRef();
          clearEditingRef();
          cyRef.current.remove(n);
          unsavedChanges();
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
          } else if (!["source", "destination"].includes(n.id())) {
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
      unsavedChanges,
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
        const initialNodes = [
          initialSource,
          initialDestination,
          "source",
          "destination",
        ];
        const { nodes, edges } = andTree.children.reduce(
          ({ nodes, edges }, node) => {
            const source = node.text;
            if (!initialNodes.includes(source)) nodes.add(source);
            const target = node.children[0]?.children?.[0]?.text || "";
            if (!initialNodes.includes(target)) nodes.add(target);
            edges.add({
              source,
              target,
              relation: (node.children[0]?.text || "").toLowerCase(),
            });
            return { nodes, edges };
          },
          {
            nodes: new Set(),
            edges: new Set<{
              source: string;
              target: string;
              relation: string;
            }>(),
          }
        );
        const elementNodes = Array.from(nodes)
          .map((node) => ({ id: (idRef.current++).toString(), node }))
          .concat([
            { id: "source", node: initialSource },
            { id: "destination", node: initialDestination },
          ])
          .map((data, i, all) => ({
            data,
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
            const targetId = ["source", "destination"].includes(target)
              ? target
              : elementNodes.find((n) => n.data.node === target)?.data?.id;
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
  const elementsRef = useRef(
    initialElements.length
      ? initialElements
      : [
          [
            {
              data: {
                id: "source",
                node: initialSource,
              },
              position: {
                x: 200,
                y: 50,
              },
            },
            {
              data: {
                id: "destination",
                node: initialDestination,
              },
              position: {
                x: 200,
                y: 350,
              },
            },
          ],
        ]
  );
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
  const [tabs, setTabs] = useState(
    initialElements.length ? initialElements.map((_, i) => i) : [0]
  );

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
      unsavedChanges();
      nodeCallback(node);
      clearEditingRef();
      clearSourceRef();
      setSelectedRelation(DEFAULT_SELECTED_RELATION);
    });
    cyRef.current.nodes().forEach(nodeCallback);
    cyRef.current.edges().forEach(edgeCallback);
    cyRef.current.nodes(`#source`).style("background-color", "darkblue");
    cyRef.current.nodes(`#destination`).style("background-color", "darkred");
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
    unsavedChanges,
  ]);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);
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
        <Button
          icon={"arrow-left"}
          disabled={loading}
          minimal
          onClick={() =>
            showBackWarning.current ? setBackWarningOpen(true) : back()
          }
        />
        <Alert
          cancelButtonText={"Cancel"}
          confirmButtonText={"Confirm"}
          onConfirm={back}
          intent={Intent.WARNING}
          isOpen={backWarningOpen}
          onCancel={() => setBackWarningOpen(false)}
        >
          <b>Warning:</b> You have unsaved changes. Are you sure you want to go
          back and discard these changes?
        </Alert>
      </h3>
      <div style={{ display: "flex" }}>
        <Label style={{ flexGrow: 1, color: "darkblue" }}>
          Source
          <MenuItemSelect
            activeItem={source}
            onItemSelect={(e) => {
              unsavedChanges();
              setSource(e);
              (cyRef.current.nodes("#source") as NodeSingular).data("node", e);
            }}
            items={nodes}
            ButtonProps={{ style: { color: "darkblue" } }}
          />
        </Label>
        <Label style={{ flexGrow: 1, color: "darkred" }}>
          Destination
          <MenuItemSelect
            activeItem={destination}
            onItemSelect={(e) => {
              unsavedChanges();
              setDestination(e);
              (cyRef.current.nodes("#destination") as NodeSingular).data(
                "node",
                e
              );
            }}
            items={nodes}
            ButtonProps={{ style: { color: "darkred" } }}
          />
        </Label>
        <Label style={{ flexGrow: 1 }}>
          Complement
          <InputGroup
            value={complement}
            onChange={(e) => {
              unsavedChanges();
              setComplement(e.target.value);
            }}
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
            disabled={loading}
            onClick={() => {
              const newId = (tabs.slice(-1)[0] || 0) + 1;
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
              unsavedChanges();
            }}
          />
        </Tabs>
      </div>
      <div className={"roamjs-discourse-edit-relations"}>
        <div
          tabIndex={-1}
          ref={containerRef}
          style={{ height: "100%", display: isPreview ? "none" : "block" }}
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
              } else if (e.key === " ") {
                e.preventDefault();
              }
              unsavedChanges();
            }
          }}
        />
        {isPreview && (
          <RelationEditPreview
            elements={elementsRef.current[tab]
              .filter((d) => !!(d.data as { relation?: string }).relation)
              .map(
                (d) =>
                  d as {
                    data: { relation: string; source: string; target: string };
                  }
              )
              .map((d) => ({
                relation: d.data.relation,
                source: (
                  elementsRef.current[tab].find(
                    (n) => n.data.id === d.data.source
                  )?.data as { node: string }
                )?.node,
                target: (
                  elementsRef.current[tab].find(
                    (n) => n.data.id === d.data.target
                  )?.data as { node: string }
                )?.node,
              }))}
          />
        )}
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
        <div style={{ zIndex: 1, position: "absolute", top: 8, right: 8 }}>
          {tabs.length > 1 && (
            <Button
              minimal
              icon={"trash"}
              disabled={loading}
              onClick={() => {
                const newTabs = tabs.filter((t) => t != tab);
                setTabs(newTabs);
                setTab(newTabs[0]);
                unsavedChanges();
              }}
              style={{ marginRight: 8 }}
            />
          )}
          <Button
            minimal
            icon={isPreview ? "edit" : "eye-open"}
            onClick={() => setIsPreview(!isPreview)}
            disabled={loading}
          />
        </div>
      </div>
      <div style={{ display: "flex" }}>
        <Button
          text={"Save"}
          intent={Intent.PRIMARY}
          disabled={loading}
          style={{ marginTop: 10, marginRight: 16 }}
          onClick={() => {
            setLoading(true);
            setTimeout(() => {
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
                                text: ["source", "destination"].includes(target)
                                  ? target
                                  : (
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
              setTimeout(back, 1);
            }, 1);
          }}
        />
        {loading && <Spinner size={SpinnerSize.SMALL} />}
      </div>
    </>
  );
};

export const RelationConfigPanel: Panel = ({ uid }) => {
  const refreshRelations = useCallback(
    () =>
      uid
        ? getShallowTreeByParentUid(uid).map((n) => {
            const fieldTree = getShallowTreeByParentUid(n.uid);
            return {
              ...n,
              source:
                getFirstChildTextByBlockUid(
                  fieldTree.find((t) => toFlexRegex("source").test(t.text))
                    ?.uid || ""
                ) || "?",
              destination:
                getFirstChildTextByBlockUid(
                  fieldTree.find((t) => toFlexRegex("destination").test(t.text))
                    ?.uid || ""
                ) || "?",
            };
          })
        : [],
    [uid]
  );
  const [relations, setRelations] = useState(refreshRelations);
  const [editingRelation, setEditingRelation] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const editingRelationInfo = useMemo(
    () => editingRelation && getTreeByBlockUid(editingRelation),
    [editingRelation]
  );
  const onNewRelation = () => {
    const relationUid = createBlock({
      parentUid: uid,
      order: relations.length,
      node: { text: newRelation },
    });
    setTimeout(() => {
      setRelations([
        ...relations,
        {
          text: newRelation,
          uid: relationUid,
          source: "?",
          destination: "?",
        },
      ]);
      setNewRelation("");
      setEditingRelation(relationUid);
    }, 1);
  };
  return editingRelation ? (
    <RelationEditPanel
      editingRelationInfo={editingRelationInfo}
      back={() => {
        setEditingRelation("");
        setRelations(refreshRelations());
      }}
    />
  ) : (
    <>
      <div>
        <div style={{ display: "flex" }}>
          <InputGroup
            value={newRelation}
            onChange={(e) => setNewRelation(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !!newRelation && onNewRelation()
            }
          />
          <Button
            onClick={onNewRelation}
            text={"Add Relation"}
            style={{ maxWidth: 120, marginLeft: 8 }}
            intent={Intent.PRIMARY}
            disabled={!newRelation}
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
              <span>
                <span style={{ display: "inline-block", width: 96 }}>
                  {rel.text}
                </span>
                <span style={{ fontSize: 10 }}>
                  ({rel.source}) {"=>"} ({rel.destination})
                </span>
              </span>
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
