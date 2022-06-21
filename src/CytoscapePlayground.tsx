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
  Dialog,
  InputGroup,
  Intent,
  Menu,
  MenuItem,
  Position,
  Tooltip,
} from "@blueprintjs/core";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import type { InputTextNode, RoamBasicNode } from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import updateBlock from "roamjs-components/writes/updateBlock";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import { render as renderToast } from "roamjs-components/components/Toast";
import setInputSetting from "roamjs-components/util/setInputSetting";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import LivePreview, { Props as LivePreviewProps } from "./LivePreview";
import { render as exportRender } from "./ExportDialog";
import {
  getDiscourseContextResults,
  getNodes,
  getRelations,
  getRelationTriples,
  matchNode,
} from "./util";
import editCursor from "./cursors/edit.png";
import trashCursor from "./cursors/trash.png";
import fuzzy from "fuzzy";
import triplesToBlocks from "./utils/triplesToBlocks";
import { renderLoading } from "roamjs-components/components/Loading";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import getSubTree from "roamjs-components/util/getSubTree";
import navigator from "cytoscape-navigator";
import Filter, { Filters } from "roamjs-components/components/Filter";
import DiscourseContextOverlay from "./components/DiscourseContextOverlay";
import createQueryBuilderRender from "./utils/createQueryBuilderRender";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";

navigator(cytoscape);

type AliasProps = {
  node: cytoscape.NodeSingular;
};

const AliasDialog = ({
  onClose,
  node,
}: {
  onClose: () => void;
} & AliasProps) => {
  const defaultValue = useMemo(() => node.data("alias"), [node]);
  const [alias, setAlias] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const onSubmit = () => {
    setLoading(false);
    const blockUid = node.data("id");
    if (alias) {
      node.data("alias", alias);
      setInputSetting({ blockUid, value: alias, key: "alias" }).then(onClose);
    } else {
      node.data("alias", node.data("label"));
      deleteBlock(getSubTree({ key: "alias", parentUid: blockUid }).uid).then(
        onClose
      );
    }
  };
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        onSubmit();
      }
      e.stopPropagation();
    },
    [onSubmit, onClose, alias]
  );
  return (
    <>
      <Dialog
        isOpen={true}
        title={"Alias Playground Node"}
        onClose={onClose}
        canOutsideClickClose
        canEscapeKeyClose
      >
        <div className={Classes.DIALOG_BODY} onKeyDown={onKeyDown}>
          <InputGroup
            defaultValue={defaultValue}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button text={"Cancel"} onClick={onClose} disabled={loading} />
            <Button
              text={"Set"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              disabled={loading}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};

const NodeIcon = ({
  shortcut,
  color,
  onClick,
}: {
  shortcut: string;
  color: string;
  onClick?: () => void;
}) => (
  <Button
    minimal
    onClick={onClick}
    style={{ maxWidth: 30 }}
    icon={
      <span
        style={{
          height: 16,
          width: 16,
          borderRadius: "50%",
          backgroundColor: `#${color}`,
          color: "#EEEEEE",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          margin: "0 2px",
        }}
        onClick={onClick}
      >
        {shortcut}
      </span>
    }
  />
);

type Props = {
  title: string;
  previewEnabled: boolean;
  globalRefs: { [key: string]: (...args: string[]) => void };
};

const useTreeFieldUid = ({
  tree,
  parentUid,
  field,
}: {
  parentUid: string;
  field: string;
  tree: RoamBasicNode[];
}) =>
  useMemo(() => {
    const node = tree.find((t) => toFlexRegex(field).test(t.text));
    const children = node?.children || [];
    if (node?.uid) {
      return [node?.uid, children] as const;
    }
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({ node: { text: field, uid: newUid }, parentUid });
    return [newUid, children] as const;
  }, [tree, field, parentUid]);

const DEFAULT_SELECTED_RELATION = {
  display: "none",
  top: 0,
  left: 0,
  label: "",
  id: "",
};

const COLORS = [
  "8b0000",
  "9b870c",
  "008b8b",
  "00008b",
  "8b008b",
  "85200c",
  "ee7600",
  "008b00",
  "26428B",
  "2f062f",
  "b80000",
  "b978c0",
  "00b8b8",
  "0000b8",
  "b800b8",
  "5802c0",
  "ee6700",
  "00b800",
  "6224B8",
  "f260f2",
];
const TEXT_COLOR = "888888";
const TEXT_TYPE = "&TEX-node";
const SELECTION_MODES = [
  { id: "NORMAL", tooltip: "Normal", icon: "new-link" },
  { id: "CONNECT", tooltip: "Draw Edge", icon: "git-branch" },
  { id: "EDIT", tooltip: "Edit", icon: "edit" },
  { id: "DELETE", tooltip: "Delete", icon: "delete" },
  { id: "ALIAS", tooltip: "Alias", icon: "application" },
] as const;
type SelectionMode = typeof SELECTION_MODES[number]["id"];

const CytoscapePlayground = ({
  title,
  previewEnabled,
  globalRefs,
  ...exportRenderProps
}: Props) => {
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const allPages = useMemo(getAllPageNames, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowInputRef = useRef<HTMLInputElement>(null);
  const cyRef = useRef<cytoscape.Core>(null);
  const sourceRef = useRef<cytoscape.NodeSingular>(null);
  const editingRef = useRef<cytoscape.SingularElementArgument>(null);
  const allNodes = useMemo(getNodes, []);
  const allRelations = useMemo(getRelations, []);
  const coloredNodes = useMemo(
    () =>
      allNodes
        .map((n, i) => ({
          color: COLORS[i % COLORS.length],
          ...n,
        }))
        .concat({
          color: TEXT_COLOR,
          text: "Text",
          shortcut: "T",
          type: TEXT_TYPE,
          format: "{content}",
        }),
    []
  );
  const nodeTypeByColor = useMemo(
    () => Object.fromEntries(coloredNodes.map((cn) => [cn.color, cn.type])),
    [coloredNodes]
  );
  const nodeTextByColor = useMemo(
    () => Object.fromEntries(coloredNodes.map((cn) => [cn.color, cn.text])),
    [coloredNodes]
  );
  const nodeFormatTextByType = useMemo(
    () =>
      Object.fromEntries(
        coloredNodes.map((cn) => [cn.type, cn.format.replace("{content}", "")])
      ),
    [coloredNodes]
  );
  const [selectedNode, setSelectedNode] = useState(
    coloredNodes[coloredNodes.length - 1]
  );
  const [editingNodeValue, setEditingNodeValue] = useState("");
  const filteredPages = useMemo(
    () =>
      editingNodeValue
        ? fuzzy
            .filter(editingNodeValue, allPages)
            .slice(0, 5)
            .map((p) => p.original)
        : [],
    [allPages, editingNodeValue]
  );
  const [filters, setFilters] = useState<Filters>({
    includes: { nodes: new Set(), edges: new Set() },
    excludes: { nodes: new Set(), edges: new Set() },
  });
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const nodeColorRef = useRef(selectedNode.color);
  const clearEditingRef = useCallback(() => {
    if (editingRef.current) {
      editingRef.current.style("border-width", 0);
      if (editingRef.current.isNode()) {
        editingRef.current.unlock();
      }
      editingRef.current = null;
      setEditingNodeValue("");
    }
  }, [editingRef, setEditingNodeValue]);
  const clearSourceRef = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.style(
        "background-color",
        `#${sourceRef.current.data("color")}`
      );
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
  const allRelationTriples = useMemo(getRelationTriples, []);
  const filteredRelations = useMemo(() => {
    if (selectedRelation.id) {
      const edge = cyRef.current.edges(
        `#${selectedRelation.id}`
      ) as cytoscape.EdgeSingular;
      const sourceColor = edge.source().data("color");
      const targetColor = edge.target().data("color");
      return allRelationTriples
        .filter((k) => {
          if (sourceColor === TEXT_COLOR || targetColor === TEXT_COLOR) {
            return true;
          }
          return (
            k.source === nodeTypeByColor[sourceColor] &&
            k.target === nodeTypeByColor[targetColor]
          );
        })
        .filter((k) => k.relation !== selectedRelation.label);
    }
    return allRelationTriples;
  }, [allRelationTriples, selectedRelation, cyRef, nodeTypeByColor]);
  const tree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const [elementsUid, elementsChildren] = useTreeFieldUid({
    tree,
    parentUid: pageUid,
    field: "elements",
  });
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("NORMAL");
  const selectionModeRef = useRef(selectionMode);
  const edgeCallback = useCallback(
    (edge: cytoscape.EdgeSingular) => {
      edge.on("click", (e) => {
        if ((e.originalEvent.target as HTMLElement).tagName !== "CANVAS") {
          return;
        }
        clearSourceRef();
        if (selectionModeRef.current === "DELETE") {
          clearEditingRef();
          deleteBlock(edge.id());
          cyRef.current.remove(edge);
        } else if (editingRef.current === edge) {
          clearEditingRef();
          clearEditingRelation();
        } else {
          clearEditingRef();
          const { x1, y1 } = cyRef.current.extent();
          const zoom = cyRef.current.zoom();
          editingRef.current = edge;
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
    [
      clearSourceRef,
      clearEditingRef,
      setSelectedRelation,
      cyRef,
      selectionModeRef,
    ]
  );
  const [livePreviewTag, setLivePreviewTag] = useState("");
  const registerMouseEvents = useCallback<
    LivePreviewProps["registerMouseEvents"]
  >(
    ({ open, close, span }) => {
      const root = span.closest<HTMLSpanElement>(".bp3-popover-wrapper");
      root.style.position = "absolute";
      cyRef.current.on("mousemove", (e) => {
        if (
          e.target === cyRef.current &&
          cyRef.current.scratch("roamjs_preview_tag")
        ) {
          cyRef.current.scratch("roamjs_preview_tag", "");
        }
        const tag = cyRef.current.scratch("roamjs_preview_tag");
        const isOpen = cyRef.current.scratch("roamjs_preview");

        if (isOpen && !tag) {
          cyRef.current.scratch("roamjs_preview", false);
          close();
        } else if (tag) {
          const { x1, y1 } = cyRef.current.extent();
          const zoom = cyRef.current.zoom();
          root.style.top = `${(e.position.y - y1) * zoom}px`;
          root.style.left = `${(e.position.x - x1) * zoom}px`;
          setLivePreviewTag(tag);
          if (!isOpen) {
            cyRef.current.scratch("roamjs_preview", true);
            open(e.originalEvent.ctrlKey);
          }
        }
      });
    },
    [cyRef]
  );
  const drawEdge = useCallback(
    ({ text, ...rest }: { text: string; source: string; target: string }) =>
      createBlock({
        node: {
          text,
          children: Object.entries(rest).map(([k, v]) => ({
            text: k,
            children: [{ text: v }],
          })),
        },
        parentUid: elementsUid,
      }).then((id) => {
        const edge = cyRef.current.add({
          data: { id, label: text, ...rest },
        });
        edgeCallback(edge);
      }),
    [edgeCallback, cyRef]
  );
  const nodeTapCallback = useCallback(
    (n: cytoscape.NodeSingular) => {
      n.style("background-color", `#${n.data("color")}`);
      n.on("click", (e) => {
        if ((e.originalEvent.target as HTMLElement).tagName !== "CANVAS") {
          return;
        }
        clearEditingRelation();
        if (selectionModeRef.current === "ALIAS") {
          clearSourceRef();
          clearEditingRef();
          createOverlayRender<AliasProps>(
            "playground-alias",
            AliasDialog
          )({
            node: n,
          });
        } else if (selectionModeRef.current === "DELETE") {
          clearSourceRef();
          clearEditingRef();
          deleteBlock(n.id());
          n.connectedEdges().forEach((edge) => {
            deleteBlock(edge.id());
          });
          cyRef.current.remove(n);
        } else if (selectionModeRef.current === "CONNECT") {
          clearEditingRef();
          if (sourceRef.current) {
            const source = sourceRef.current.id();
            const target = n.id();
            if (source !== target) {
              const sourceType =
                nodeTypeByColor[sourceRef.current.data("color")];
              const targetType = nodeTypeByColor[n.data("color")];
              const text =
                allRelationTriples.find(
                  (r) => r.source === sourceType && r.target === targetType
                )?.relation ||
                (sourceType === TEXT_TYPE || targetType === TEXT_TYPE
                  ? allRelationTriples[0].relation
                  : "");
              if (text) {
                drawEdge({ text, source, target });
              } else {
                renderToast({
                  id: "roamjs-discourse-relation-error",
                  intent: Intent.DANGER,
                  content:
                    "There are no relations defined between these two node types",
                });
              }
            }
            clearSourceRef();
          } else {
            n.style("background-color", "#000000");
            n.lock();
            sourceRef.current = n;
          }
        } else if (selectionModeRef.current === "NORMAL") {
          const title = n.data("label");
          const uid = getPageUidByPageTitle(title);
          (uid ? Promise.resolve(uid) : createPage({ title })).then((uid) =>
            openBlockInSidebar(uid)
          );
        } else if (selectionModeRef.current === "EDIT") {
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
            setEditingNodeValue(n.data("label"));
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
      n.on("mousemove", () => {
        if (selectionModeRef.current === "NORMAL") {
          containerRef.current.style.cursor = "pointer";
        } else if (selectionModeRef.current === "ALIAS") {
          containerRef.current.style.cursor = "alias";
        } else if (selectionModeRef.current === "DELETE") {
          containerRef.current.style.cursor = `url(${trashCursor}), auto`;
        } else if (selectionModeRef.current === "EDIT") {
          containerRef.current.style.cursor = `url(${editCursor}), auto`;
        } else if (selectionModeRef.current === "CONNECT") {
          containerRef.current.style.cursor = "cell";
        }
      });
      n.on("mouseover", () => {
        const tag = n.data("label");
        cyRef.current.scratch("roamjs_preview_tag", tag);
      });
      n.on("mouseout", () => {
        cyRef.current.scratch("roamjs_preview_tag", "");
        n.style("color", "#EEEEEE");
        containerRef.current.style.cursor = "unset";
      });
    },
    [
      elementsUid,
      sourceRef,
      cyRef,
      editingRef,
      allRelationTriples,
      shadowInputRef,
      containerRef,
      clearEditingRef,
      clearSourceRef,
      clearEditingRelation,
      drawEdge,
    ]
  );
  const createNode = useCallback(
    (text: string, position: { x: number; y: number }, color: string) => {
      createBlock({
        node: {
          text,
          children: [
            { text: "x", children: [{ text: position.x.toString() }] },
            { text: "y", children: [{ text: position.y.toString() }] },
            { text: "color", children: [{ text: color }] },
          ],
        },
        parentUid: elementsUid,
      }).then((uid) => {
        const node = cyRef.current.add({
          data: { id: uid, label: text, color, alias: text },
          position,
        })[0];
        nodeTapCallback(node);
      });
    },
    [nodeTapCallback, cyRef, elementsUid, nodeColorRef]
  );
  useEffect(() => {
    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...elementsChildren.map(({ text, uid, children = [] }) => {
          const {
            x = "0",
            y = "0",
            color = TEXT_COLOR,
            alias,
            ...data
          } = Object.fromEntries(
            children.map(({ text, children = [] }) => [text, children[0]?.text])
          );
          const label = text || "Click to edit text";
          return {
            data: {
              alias: alias || label,
              label,
              color,
              id: uid,
              ...data,
            },
            position: { x: Number(x), y: Number(y) },
          };
        }),
      ],

      style: [
        {
          selector: "node",
          style: {
            "background-color": `#${TEXT_COLOR}`,
            label: "data(alias)",
            shape: "round-rectangle",
            color: "#EEEEEE",
            "text-wrap": "wrap",
            "text-halign": "center",
            "text-valign": "center",
            "text-max-width": "320",
            width: "label",
            "padding-left": "16",
            "padding-right": "16",
            "padding-bottom": "8",
            "padding-top": "8",
            height: "label",
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
      if (
        e.target !== cyRef.current ||
        (e.originalEvent.target as HTMLElement).tagName !== "CANVAS"
      ) {
        return;
      }
      if (!editingRef.current && !sourceRef.current) {
        const nodeType = nodeTypeByColor[nodeColorRef.current];
        createNode(
          nodeFormatTextByType[nodeType] || "Click to edit text",
          e.position,
          nodeColorRef.current
        );
      } else {
        clearEditingRef();
        clearSourceRef();
        clearEditingRelation();
      }
    });
    cyRef.current.nodes().forEach(nodeTapCallback);
    cyRef.current.edges().forEach(edgeCallback);
    globalRefs.clearOnClick = (s: string) => {
      const { x1, x2, y1, y2 } = cyRef.current.extent();
      createNode(
        s,
        { x: (x2 + x1) / 2, y: (y2 + y1) / 2 },
        coloredNodes.find((c) => matchNode({ format: c.format, title: s }))
          ?.color || TEXT_COLOR
      );
    };
    // @ts-ignore
    const nav = cyRef.current.navigator({
      container: `.cytoscape-navigator`,
    });
    console.log(nav);
  }, [
    elementsUid,
    cyRef,
    containerRef,
    clearSourceRef,
    clearEditingRelation,
    clearEditingRef,
    edgeCallback,
    nodeTapCallback,
    createNode,
    nodeTypeByColor,
    nodeColorRef,
  ]);
  const [maximized, setMaximized] = useState(false);
  const maximize = useCallback(() => setMaximized(true), [setMaximized]);
  const minimize = useCallback(() => setMaximized(false), [setMaximized]);
  const [mapOpen, setMapOpen] = useState(false);
  const searchRef = useRef<HTMLSpanElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchOptions = useMemo(
    () => (searchOpen ? cyRef.current.nodes().map((n) => n.data("alias")) : []),
    [searchOpen, cyRef]
  );
  const [overlaysShown, setOverlaysShown] = useState(false);
  const getStyle = useCallback(
    (e: cytoscape.NodeSingular) => {
      const { x1, y1 } = cyRef.current.extent();
      const zoom = cyRef.current.zoom();
      const { x, y } = e.position();
      return {
        top: (y - y1 + e.height() / 2) * zoom,
        left: (x - x1 - e.width() / 2) * zoom,
      };
    },
    [cyRef]
  );
  const [nodeOverlays, setNodeOverlays] = useState<
    Record<string, { top: number; left: number; label: string }>
  >({});
  useEffect(() => {
    if (overlaysShown)
      setNodeOverlays(
        Object.fromEntries(
          cyRef.current
            .nodes()
            .filter((t) => t.data("color") !== TEXT_COLOR)
            .map((n) => [
              `roamjs-cytoscape-node-overlay-${n.id()}`,
              {
                label: n.data("label"),
                ...getStyle(n as cytoscape.NodeSingular),
              },
            ])
        )
      );
    else setNodeOverlays({});
  }, [overlaysShown, setNodeOverlays, cyRef]);

  useEffect(() => {
    const isNodeValid = (other: cytoscape.NodeSingular) => {
      const otherText = nodeTextByColor[other.data("color")];
      return (
        (filters.includes.nodes.size === 0 &&
          filters.includes.edges.size === 0 &&
          !filters.excludes.nodes.has(otherText)) ||
        filters.includes.nodes.has(otherText)
      );
    };

    const isEdgeValid = (other: cytoscape.EdgeSingular) =>
      (filters.includes.edges.size === 0 &&
        filters.includes.nodes.size === 0 &&
        !filters.excludes.edges.has(other.data("label"))) ||
      filters.includes.edges.has(other.data("label"));

    cyRef.current.nodes().forEach((other) => {
      if (
        isNodeValid(other) ||
        other.connectedEdges().some(isEdgeValid) ||
        other.connectedEdges().some((e) =>
          (e as cytoscape.EdgeSingular)
            .connectedNodes()
            .filter((n) => n !== other)
            .some(isNodeValid)
        )
      ) {
        other.style("display", "element");
      } else {
        other.style("display", "none");
      }
      other.edges();
    });

    cyRef.current.edges().forEach((other) => {
      if (isEdgeValid(other) || other.connectedNodes().some(isNodeValid)) {
        other.style("display", "element");
      } else {
        other.style("display", "none");
      }
    });
  }, [cyRef, nodeTextByColor, filters]);
  return (
    <div
      className={`border border-gray-300 rounded-md bg-white h-full w-full z-10 ${
        maximized ? "absolute inset-0" : "relative"
      }`}
      id={`roamjs-cytoscape-playground-container`}
      ref={containerRef}
    >
      <style>{`.roam-article .rm-block-children {
  display: none;
}

.cytoscape-navigator{
	position: absolute;
	background: #fff;
	z-index: 99999;
	width: 200px;
	height: 200px;
	bottom: 0;
	right: 0;
	overflow: hidden;
  display: none;
}

.cytoscape-navigator > img{
	max-width: 100%;
	max-height: 100%;
}

.cytoscape-navigator > canvas{
	position: absolute;
	top: 0;
	left: 0;
	z-index: 101;
}

.cytoscape-navigatorView{
	position: absolute;
	top: 0;
	left: 0;
	cursor: move;
	background: #B7E1ED;
	-moz-opacity: 0.50;
	opacity: 0.50;
	-ms-filter:"progid:DXImageTransform.Microsoft.Alpha"(Opacity=50);
	z-index: 102;
}

.cytoscape-navigatorOverlay{
	position: absolute;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	z-index: 103;
}`}</style>
      <div
        className={
          "z-20 absolute flex w-full justify-between shadow-md bg-gray-100 rounded-md px-4 py-2"
        }
      >
        <div className="flex gap-2">
          {SELECTION_MODES.map((m) => (
            <Tooltip
              content={m.tooltip}
              key={m.id}
              position={Position.BOTTOM_LEFT}
            >
              <Button
                onClick={() => {
                  setSelectionMode(m.id);
                  selectionModeRef.current = m.id;
                }}
                minimal
                active={selectionMode === m.id}
                icon={m.icon}
              />
            </Tooltip>
          ))}
        </div>
        <div className="flex flex-col gap-2 justify-end relative items-end">
          <span>
            <Tooltip content={"Node Picker"} position={Position.BOTTOM_RIGHT}>
              <NodeIcon
                {...selectedNode}
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
              />
            </Tooltip>
            <Filter
              data={{
                nodes: allNodes.map((n) => n.text),
                edges: allRelations.flatMap((r) => [r.label, r.complement]),
              }}
              onChange={setFilters}
            />
            {searchOpen ? (
              <>
                <Tooltip
                  content={"Close Search"}
                  position={Position.BOTTOM_RIGHT}
                >
                  <Button
                    minimal
                    icon={"search"}
                    active
                    onClick={() => setSearchOpen(false)}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip content={"Open Search"} position={Position.BOTTOM_RIGHT}>
                <Button
                  minimal
                  icon={"search"}
                  onClick={() => {
                    setSearchOpen(true);
                    const input = searchRef.current.querySelector("input");
                    if (input) {
                      setTimeout(() => input.focus({ preventScroll: true }), 1);
                    }
                  }}
                />
              </Tooltip>
            )}
            {mapOpen ? (
              <>
                <style>{`#roamjs-cytoscape-playground-container .cytoscape-navigator{ display: block; }`}</style>
                <Tooltip content={"Close Map"} position={Position.BOTTOM_RIGHT}>
                  <Button
                    minimal
                    icon={"map"}
                    active
                    onClick={() => setMapOpen(false)}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip content={"Open Map"} position={Position.BOTTOM_RIGHT}>
                <Button minimal icon={"map"} onClick={() => setMapOpen(true)} />
              </Tooltip>
            )}
            {overlaysShown ? (
              <>
                <Tooltip
                  content={"Hide Overlays"}
                  position={Position.BOTTOM_RIGHT}
                >
                  <Button
                    minimal
                    icon={"widget"}
                    active
                    onClick={() => setOverlaysShown(false)}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip
                content={"Show Overlays"}
                position={Position.BOTTOM_RIGHT}
              >
                <Button
                  minimal
                  icon={"widget"}
                  onClick={() => setOverlaysShown(true)}
                />
              </Tooltip>
            )}
            <Tooltip
              content={"Draw Existing Edges"}
              position={Position.BOTTOM_RIGHT}
            >
              <Button
                minimal
                icon={"circle-arrow-down"}
                onClick={() => {
                  const closeLoading = renderLoading(getCurrentPageUid());
                  setTimeout(async () => {
                    const elementsTree = getBasicTreeByParentUid(elementsUid);
                    const relationData = getRelations();
                    const nodeData = getNodes();
                    const nodes = await Promise.all(
                      elementsTree
                        .map((n) => {
                          const getNodeType = (t: RoamBasicNode) =>
                            nodeTypeByColor[
                              getSettingValueFromTree({
                                tree: t.children,
                                key: "color",
                              })
                            ];
                          return {
                            node: n.text,
                            uid: n.uid,
                            type: getNodeType(n),
                          };
                        })
                        .filter((e) => !!e.type)
                        .map((e) =>
                          getDiscourseContextResults(
                            e.node,
                            nodeData,
                            relationData,
                            true
                          ).then((results) => ({
                            id: e.uid,
                            uid: getPageUidByPageTitle(e.node),
                            results,
                          }))
                        )
                    );
                    const validNodes = Object.fromEntries(
                      nodes.map((n) => [n.uid, n.id])
                    );
                    const edges = nodes.flatMap((e) =>
                      e.results.flatMap((result) =>
                        Object.entries(result.results)
                          .filter(([k, v]) => !v.complement && !!validNodes[k])
                          .map(([target]) => {
                            return drawEdge({
                              target: validNodes[target],
                              source: e.id,
                              text: result.label,
                            });
                          })
                      )
                    );
                    Promise.all(edges)
                      .catch((e) =>
                        renderToast({
                          id: "playground-error",
                          content: `Failed to render new edges: ${e.message}`,
                        })
                      )
                      .finally(closeLoading);
                  }, 1);
                }}
              />
            </Tooltip>
            {maximized ? (
              <>
                <style>{`div.roam-body div.roam-app div.roam-main div.roam-article {\n  position: static;\n}`}</style>
                <Tooltip content={"Minimize"} position={Position.BOTTOM_RIGHT}>
                  <Button minimal icon={"minimize"} onClick={minimize} />
                </Tooltip>
              </>
            ) : (
              <Tooltip content={"Maximize"} position={Position.BOTTOM_RIGHT}>
                <Button minimal icon={"maximize"} onClick={maximize} />
              </Tooltip>
            )}
            <Tooltip
              content={"Generate Roam Blocks"}
              position={Position.BOTTOM_RIGHT}
            >
              <Button
                minimal
                style={{ maxWidth: 30 }}
                icon={
                  <img
                    src={"https://roamresearch.com/favicon.ico"}
                    height={16}
                    width={16}
                  />
                }
                onClick={() => {
                  const elementsTree = getBasicTreeByParentUid(elementsUid);
                  const relationData = getRelations();
                  const recentPageRef: Record<string, string> = {};
                  const recentlyOpened = new Set<string>();
                  const connectedNodeUids = new Set<string>();
                  elementsTree
                    .map((n) => {
                      const sourceUid = n.children.find((c) =>
                        toFlexRegex("source").test(c.text)
                      )?.children?.[0]?.text;
                      const targetUid = n.children.find((c) =>
                        toFlexRegex("target").test(c.text)
                      )?.children?.[0]?.text;
                      const getNodeType = (t: RoamBasicNode) =>
                        nodeTypeByColor[
                          (t?.children || []).find((s) =>
                            toFlexRegex("color").test(s.text)
                          )?.children?.[0]?.text
                        ];
                      if (sourceUid && targetUid) {
                        const sourceNode = elementsTree.find(
                          (b) => b.uid === sourceUid
                        );
                        const targetNode = elementsTree.find(
                          (b) => b.uid === targetUid
                        );
                        connectedNodeUids.add(sourceUid);
                        connectedNodeUids.add(targetUid);
                        return {
                          source: {
                            text: sourceNode?.text || "",
                            type: getNodeType(sourceNode),
                          },
                          target: {
                            text: targetNode?.text || "",
                            type: getNodeType(targetNode),
                          },
                          relation: n.text,
                        };
                      }
                      return {
                        node: n.text,
                        uid: n.uid,
                        type: getNodeType(n),
                      };
                    })
                    .map((e) => {
                      if (!e.relation)
                        return connectedNodeUids.has(e.uid)
                          ? []
                          : e.type === TEXT_TYPE
                          ? [
                              {
                                source: "block",
                                target: e.node,
                                relation: "with text",
                              },
                            ]
                          : [
                              {
                                source: "block",
                                target: "page",
                                relation: "references",
                              },
                              {
                                source: "page",
                                relation: "has title",
                                target: e.node,
                              },
                            ];
                      const found = relationData.find(
                        (r) =>
                          (r.label === e.relation &&
                            ([TEXT_TYPE, r.source].includes(e.source.type) ||
                              r.source === "*") &&
                            ([TEXT_TYPE, r.destination].includes(
                              e.target.type
                            ) ||
                              r.destination === "*")) ||
                          (r.complement === e.relation &&
                            ([TEXT_TYPE, r.source].includes(e.target.type) ||
                              r.source === "*") &&
                            ([TEXT_TYPE, r.destination].includes(
                              e.source.type
                            ) ||
                              r.destination === "*"))
                      );
                      if (!found) return [];
                      const { triples, label } = found;
                      const isOriginal = label === e.relation;
                      const newTriples = triples.map((t) => {
                        if (/is a/i.test(t[1])) {
                          const targetNode =
                            (t[2] === "source" && isOriginal) ||
                            (t[2] === "destination" && !isOriginal)
                              ? e.source
                              : e.target;
                          return [
                            t[0],
                            targetNode.type === TEXT_TYPE
                              ? "with text"
                              : "has title",
                            targetNode.text,
                          ];
                        }
                        return t.slice(0);
                      });
                      return newTriples.map(([source, relation, target]) => ({
                        source,
                        relation,
                        target,
                      }));
                    })
                    .forEach(
                      triplesToBlocks({
                        defaultPageTitle: `Auto generated from ${title}`,
                        toPage: (title: string, blocks: InputTextNode[]) => {
                          const parentUid =
                            getPageUidByPageTitle(title) ||
                            recentPageRef[title];
                          (parentUid
                            ? Promise.resolve(parentUid)
                            : createPage({
                                title: title,
                              }).then(
                                (parentUid) =>
                                  (recentPageRef[title] = parentUid)
                              )
                          ).then((parentUid) => {
                            blocks.forEach((node, order) =>
                              createBlock({ node, order, parentUid })
                            );
                            if (!recentlyOpened.has(parentUid)) {
                              recentlyOpened.add(parentUid);
                              setTimeout(
                                () => openBlockInSidebar(parentUid),
                                1000
                              );
                            }
                          });
                        },
                      })
                    );
                }}
              />
            </Tooltip>
            <Tooltip content={"Export"} position={Position.BOTTOM_RIGHT}>
              <Button
                minimal
                icon={"export"}
                onClick={() => {
                  const elementsTree = getBasicTreeByParentUid(elementsUid);
                  const elementTextByUid = Object.fromEntries(
                    elementsTree.map(({ uid, text }) => [uid, text])
                  );
                  const nodesOrRelations = elementsTree.map((n) => {
                    const sourceUid = getSettingValueFromTree({
                      tree: n.children,
                      key: "source",
                    });
                    const targetUid = getSettingValueFromTree({
                      tree: n.children,
                      key: "target",
                    });
                    if (sourceUid && targetUid) {
                      return {
                        source: elementTextByUid[sourceUid],
                        target: elementTextByUid[targetUid],
                        relation: n.text,
                      };
                    }
                    return { node: n.text };
                  });
                  const nodes = nodesOrRelations
                    .filter((n) => !!n.node)
                    .map((n) => n.node as string);
                  const nodeUids = Object.fromEntries(
                    nodes.map((n) => [
                      n,
                      getPageUidByPageTitle(n) ||
                        window.roamAlphaAPI.util.generateUID(),
                    ])
                  );
                  exportRender({
                    fromQuery: {
                      nodes: nodes.map((title) => ({
                        text: title,
                        uid: nodeUids[title],
                      })),
                      relations: nodesOrRelations
                        .filter((n) => !n.node)
                        .map((n) => ({
                          source: nodeUids[n.source],
                          target: nodeUids[n.target],
                          label: n.relation,
                        })),
                    },
                    ...exportRenderProps,
                  });
                }}
              />
            </Tooltip>
          </span>
          <span
            className={`${colorPickerOpen ? "inline-flex" : "hidden"} absolute`}
            style={{ top: "150%" }}
          >
            {coloredNodes
              .filter((f) => f !== selectedNode)
              .map((n) => (
                <Tooltip
                  content={n.text}
                  key={n.text}
                  position={Position.BOTTOM_RIGHT}
                >
                  <NodeIcon
                    {...n}
                    onClick={() => {
                      nodeColorRef.current = n.color;
                      setSelectedNode(n);
                      setColorPickerOpen(false);
                    }}
                    key={n.text}
                  />
                </Tooltip>
              ))}
          </span>
          <span
            className={`${searchOpen ? "inline-flex" : "hidden"} absolute`}
            style={{ top: "150%" }}
            ref={searchRef}
          >
            <AutocompleteInput
              onConfirm={() => {
                const node = cyRef.current
                  .nodes()
                  .filter((n) => n.data("alias") === searchValue);
                if (node) cyRef.current.center(node);
              }}
              value={searchValue}
              setValue={setSearchValue}
              options={searchOptions}
            />
          </span>
        </div>
      </div>
      <Menu
        style={{
          position: "absolute",
          ...selectedRelation,
          zIndex: 1,
          background: "#eeeeee",
        }}
      >
        {filteredRelations.length ? (
          Array.from(new Set(filteredRelations.map((k) => k.relation)))
            .sort()
            .map((k) => (
              <MenuItem
                key={k}
                text={k}
                onClick={() => {
                  const edge = cyRef.current.edges(
                    `#${selectedRelation.id}`
                  ) as cytoscape.EdgeSingular;
                  updateBlock({ uid: edge.id(), text: k });
                  edge.data("label", k);
                  clearEditingRelation();
                  clearEditingRef();
                }}
              />
            ))
        ) : (
          <MenuItem
            text={"No other relation could connect these nodes"}
            disabled
          />
        )}
      </Menu>
      <div style={{ width: 0, overflow: "hidden" }}>
        <input
          ref={shadowInputRef}
          style={{ opacity: 0, position: "absolute" }}
          value={editingNodeValue}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              clearEditingRef();
              shadowInputRef.current.blur();
            }
          }}
          onChange={(e) => {
            const newValue = e.target.value;
            if (
              editingRef.current.data("label") ===
              editingRef.current.data("alias")
            )
              editingRef.current.data("alias", newValue);
            editingRef.current.data("label", newValue);
            setEditingNodeValue(newValue);
            updateBlock({ uid: editingRef.current.id(), text: newValue });
          }}
        />
      </div>
      {!!filteredPages.length && (
        <Menu
          style={{
            position: "absolute",
            top: shadowInputRef.current.style.top,
            left: shadowInputRef.current.style.left,
            zIndex: 1,
            background: "#eeeeee",
          }}
        >
          {filteredPages.map((k) => (
            <MenuItem
              key={k}
              text={k}
              onClick={() => {
                if (
                  editingRef.current.data("label") ===
                  editingRef.current.data("alias")
                )
                  editingRef.current.data("alias", k);
                editingRef.current.data("label", k);
                updateBlock({ uid: editingRef.current.id(), text: k });
                clearEditingRef();
                shadowInputRef.current.blur();
              }}
            />
          ))}
        </Menu>
      )}
      {previewEnabled && (
        <LivePreview
          tag={livePreviewTag}
          registerMouseEvents={registerMouseEvents}
        />
      )}
      <div className="cytoscape-navigator border border-gray-300 rounded-tl-md" />
      {Object.entries(nodeOverlays).map(([k, { label, ...style }]) => (
        <div
          className="absolute inline bg-gray-100"
          style={style}
          id={k}
          key={k}
        >
          <DiscourseContextOverlay tag={label} id={k} />
        </div>
      ))}
    </div>
  );
};

export const render = createQueryBuilderRender(CytoscapePlayground);

export default CytoscapePlayground;
