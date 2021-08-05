import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import cytoscape from "cytoscape";
import {
  Button,
  Classes,
  Drawer,
  Menu,
  MenuItem,
  Position,
  Tooltip,
} from "@blueprintjs/core";
import {
  createBlock,
  deleteBlock,
  getFirstChildTextByBlockUid,
  getPageUidByPageTitle,
  getShallowTreeByParentUid,
  updateBlock,
} from "roam-client";
import { setInputSetting, toFlexRegex } from "roamjs-components";
import SynthesisQuery from "./SynthesisQuery";
import { getRelationLabels } from "./util";

const SynthesisQueryPane = ({
  blockUid,
  isOpen,
  close,
}: {
  blockUid: string;
  isOpen: boolean;
  close: () => void;
}) => {
  return (
    <Drawer
      isOpen={isOpen}
      isCloseButtonShown
      onClose={close}
      position={Position.LEFT}
      title={"Synthesis Query"}
      hasBackdrop={false}
      canOutsideClickClose={false}
      canEscapeKeyClose
    >
      <div className={Classes.DRAWER_BODY}>
        <SynthesisQuery blockUid={blockUid} />
      </div>
    </Drawer>
  );
};

type Props = {
  title: string;
};

const useTreeFieldUid = ({
  tree,
  parentUid,
  field,
}: {
  parentUid: string;
  field: string;
  tree: { text: string; uid: string }[];
}) =>
  useMemo(
    () =>
      tree.find((t) => toFlexRegex(field).test(t.text))?.uid ||
      createBlock({ node: { text: field }, parentUid }),
    [tree, field, parentUid]
  );

const DEFAULT_SELECTED_RELATION = {
  display: "none",
  top: 0,
  left: 0,
  label: "",
  id: "",
};

const CytoscapePlayground = ({ title }: Props) => {
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowInputRef = useRef<HTMLInputElement>(null);
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
  const clearEditingRelation = useCallback(() => {
    setSelectedRelation(DEFAULT_SELECTED_RELATION);
    cyRef.current.zoomingEnabled(true);
    cyRef.current.panningEnabled(true);
  }, [setSelectedRelation, cyRef]);
  const allRelations = useMemo(getRelationLabels, []);
  const tree = useMemo(() => getShallowTreeByParentUid(pageUid), [pageUid]);
  const elementsUid = useTreeFieldUid({
    tree,
    parentUid: pageUid,
    field: "elements",
  });
  const queryUid = useTreeFieldUid({
    tree,
    parentUid: pageUid,
    field: "query",
  });
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
          deleteBlock(edge.id());
          cyRef.current.remove(edge);
        } else {
          const { x1, y1 } = cyRef.current.extent();
          const zoom = cyRef.current.zoom();
          setSelectedRelation({
            display: "block",
            top: (e.position.y - y1) * zoom,
            left: (e.position.x - x1) * zoom,
            label: edge.data("label"),
            id: edge.id(),
          });
          cyRef.current.zoomingEnabled(false);
          cyRef.current.panningEnabled(false);
        }
      });
    },
    [clearSourceRef, clearEditingRef, setSelectedRelation, cyRef, blockClickRef]
  );
  const nodeTapCallback = useCallback(
    (n: cytoscape.NodeSingular) => {
      n.on("click", (e) => {
        if (blockClickRef.current) {
          return;
        }
        e.stopPropagation();
        clearEditingRelation();
        if (e.originalEvent.ctrlKey) {
          clearSourceRef();
          clearEditingRef();
          deleteBlock(n.id());
          n.connectedEdges().forEach((edge) => {
            deleteBlock(edge.id());
          });
          cyRef.current.remove(n);
        } else if (e.originalEvent.shiftKey) {
          clearEditingRef();
          if (sourceRef.current) {
            const source = sourceRef.current.id();
            const target = n.id();
            if (source !== target) {
              const text = allRelations[0];
              const rest = {
                source,
                target,
              };
              const id = createBlock({
                node: {
                  text,
                  children: Object.entries(rest).map(([k, v]) => ({
                    text: k,
                    children: [{ text: v }],
                  })),
                },
                parentUid: elementsUid,
              });
              const edge = cyRef.current.add({
                data: { id, label: text, ...rest },
              });
              edgeCallback(edge);
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
            shadowInputRef.current.value = n.data("label");
            shadowInputRef.current.focus({ preventScroll: true });
            const { x1, y1 } = cyRef.current.extent();
            const zoom = cyRef.current.zoom();
            shadowInputRef.current.style.top = `${
              (e.position.y - y1) * zoom
            }px`;
            shadowInputRef.current.style.left = `${
              (e.position.x - x1) * zoom
            }px`;
            n.style("border-width", 4);
          }
        }
      });
      n.on("dragfree", () => {
        const uid = n.data("id");
        const { x, y } = n.position();
        setInputSetting({ blockUid: uid, value: `${x}`, key: "x" });
        setInputSetting({ blockUid: uid, value: `${y}`, key: "y" });
      });
    },
    [
      elementsUid,
      sourceRef,
      cyRef,
      blockClickRef,
      editingRef,
      allRelations,
      shadowInputRef,
      containerRef,
      clearEditingRef,
      clearSourceRef,
      clearEditingRelation,
      edgeCallback,
    ]
  );
  useEffect(() => {
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...getShallowTreeByParentUid(elementsUid).map(({ text, uid }) => {
          const {
            x = "0",
            y = "0",
            ...data
          } = Object.fromEntries(
            getShallowTreeByParentUid(uid).map(({ text, uid }) => [
              text,
              getFirstChildTextByBlockUid(uid),
            ])
          );
          return {
            data: {
              label: text,
              ...data,
              id: uid,
            },
            position: { x: Number(x), y: Number(y) },
          };
        }),
      ],

      style: [
        {
          selector: "node",
          style: {
            "background-color": "#888888",
            label: "data(label)",
            shape: "round-rectangle",
            color: "#ffffff",
            "text-wrap": "wrap",
            "text-halign": "center",
            "text-valign": "center",
            "text-max-width": "160",
            width: 160,
            height: 160,
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
            label: "data(label)",
          },
        },
      ],

      layout: {
        name: "preset",
      },
      maxZoom: 5,
      minZoom: 0.25,
    });
    cyRef.current.on("click", (e) => {
      if (blockClickRef.current) {
        return;
      }
      const { position } = e;
      const text = "Click to edit block";
      const uid = createBlock({
        node: { text },
        parentUid: elementsUid,
      });
      const node = cyRef.current.add({
        data: { id: uid, label: text },
        position,
      })[0];
      nodeTapCallback(node);
      clearEditingRef();
      clearSourceRef();
      clearEditingRelation();
    });
    cyRef.current.nodes().forEach(nodeTapCallback);
    cyRef.current.edges().forEach(edgeCallback);
  }, [
    elementsUid,
    cyRef,
    containerRef,
    clearSourceRef,
    clearEditingRelation,
    clearEditingRef,
    edgeCallback,
    nodeTapCallback,
  ]);
  const [maximized, setMaximized] = useState(false);
  const maximize = useCallback(() => setMaximized(true), [setMaximized]);
  const minimize = useCallback(() => setMaximized(false), [setMaximized]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const onDrawerOpen = useCallback(
    () => setIsDrawerOpen(true),
    [setIsDrawerOpen]
  );
  const onDrawerClose = useCallback(
    () => setIsDrawerOpen(false),
    [setIsDrawerOpen]
  );
  return (
    <>
      {" "}
      <div
        style={{
          width: "100%",
          height: "100%",
          border: "1px solid gray",
          background: "white",
          zIndex: 1,
          ...(maximized ? { inset: 0, position: "absolute" } : {}),
        }}
        ref={containerRef}
      >
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
          <Tooltip content={"Open Synthesis Query Pane"}>
            <Button
              icon={"drawer-left"}
              onClick={onDrawerOpen}
              style={{ marginRight: 8 }}
            />
          </Tooltip>
          {maximized ? (
            <>
              <style>{`div.roam-body div.roam-app div.roam-main div.roam-article {\n  position: static;\n}`}</style>
              <Tooltip content={"Minimize"}>
                <Button icon={"minimize"} onClick={minimize} />
              </Tooltip>
            </>
          ) : (
            <Tooltip content={"Maximize"}>
              <Button icon={"maximize"} onClick={maximize} />
            </Tooltip>
          )}
        </div>
        <SynthesisQueryPane
          isOpen={isDrawerOpen}
          close={onDrawerClose}
          blockUid={queryUid}
        />
        <Menu
          style={{
            position: "absolute",
            ...selectedRelation,
            zIndex: 1,
            background: "#eeeeee",
          }}
        >
          {allRelations
            .filter((k) => k !== selectedRelation.label)
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
                  ).data("label", k);
                  clearEditingRelation();
                  e.stopPropagation();
                }}
              />
            ))}
        </Menu>
        <div style={{ width: 0, overflow: "hidden" }}>
          <input
            ref={shadowInputRef}
            style={{ opacity: 0, position: "absolute" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                clearEditingRef();
                shadowInputRef.current.blur();
              }
            }}
            onChange={(e) => {
              const newValue = e.target.value;
              editingRef.current.data("label", newValue);
              updateBlock({ uid: editingRef.current.id(), text: newValue });
            }}
          />
        </div>
      </div>
    </>
  );
};

export const render = ({ p, ...props }: { p: HTMLElement } & Props) =>
  ReactDOM.render(<CytoscapePlayground {...props} />, p);

export default CytoscapePlayground;
