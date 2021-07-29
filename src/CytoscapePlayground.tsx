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
  Drawer,
  InputGroup,
  Intent,
  Label,
  Position,
  Tooltip,
} from "@blueprintjs/core";
import {
  createBlock,
  getFirstChildTextByBlockUid,
  getPageUidByPageTitle,
  getShallowTreeByParentUid,
} from "roam-client";
import { setInputSetting, toFlexRegex } from "roamjs-components";
import SynthesisQuery from "./SynthesisQuery";

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
      title={'Synthesis Query'}
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

const CytoscapePlayground = ({ title }: Props) => {
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core>(null);
  const sourceRef = useRef<cytoscape.NodeSingular>(null);
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
  const nodeTapCallback = useCallback(
    (n: cytoscape.NodeSingular) => {
      n.on("tap", () => {
        if (sourceRef.current) {
          const source = sourceRef.current.id();
          const target = n.id();
          if (source !== target) {
            const data = {
              id: `${sourceRef.current.data("uid")}-${n.data("uid")}`,
              source,
              target,
            };
            const edge = cyRef.current.add({ data })[0];
            const { id: text, ...rest } = data;
            const uid = createBlock({
              node: {
                text,
                children: Object.entries(rest).map(([k, v]) => ({
                  text: k,
                  children: [{ text: v }],
                })),
              },
              parentUid: elementsUid,
            });
            edge.data("uid", uid);
          }
          sourceRef.current.style("background-color", "#00F");
          sourceRef.current.unlock();
          sourceRef.current = null;
        } else {
          n.style("background-color", "#0F0");
          n.lock();
          sourceRef.current = n;
        }
      });
      n.on("dragfree", () => {
        const uid = n.data("uid");
        const { x, y } = n.position();
        setInputSetting({ blockUid: uid, value: `${x}`, key: "x" });
        setInputSetting({ blockUid: uid, value: `${y}`, key: "y" });
      });
    },
    [elementsUid, sourceRef, cyRef]
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
              id: text,
              ...data,
              uid,
            },
            position: { x: Number(x), y: Number(y) },
          };
        }),
      ],

      style: [
        {
          selector: "node",
          style: {
            "background-color": "#00F",
            label: "data(id)",
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
            label: 'hey you',
          },
        },
      ],

      layout: {
        name: "preset",
      },
    });
    cyRef.current.nodes().forEach(nodeTapCallback);
  }, [elementsUid, cyRef, containerRef]);
  const [newNode, setNewNode] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = useCallback(() => setIsOpen(true), [setIsOpen]);
  const onClose = useCallback(() => setIsOpen(false), [setIsOpen]);
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
        <Tooltip content={"Add Node"}>
          <Button icon={"circle"} onClick={onOpen} style={{ marginLeft: 8 }} />
        </Tooltip>
        <Dialog
          isOpen={isOpen}
          onClose={onClose}
          title={"Add Node"}
          canOutsideClickClose
          canEscapeKeyClose
        >
          <div className={Classes.DIALOG_BODY}>
            <Label>
              Node Label
              <InputGroup
                placeholder={"Enter node label..."}
                value={newNode}
                onChange={(e) => setNewNode(e.target.value)}
              />
            </Label>
          </div>
          <div className={Classes.DIALOG_FOOTER}>
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Button
                intent={Intent.WARNING}
                onClick={onClose}
                text={"Cancel"}
              />
              <Button
                intent={Intent.PRIMARY}
                onClick={() => {
                  const node = cyRef.current.add({ data: { id: newNode } })[0];
                  const uid = createBlock({
                    node: { text: newNode },
                    parentUid: elementsUid,
                  });
                  nodeTapCallback(node);
                  node.data("uid", uid);
                  onClose();
                }}
                text={"Create"}
              />
            </div>
          </div>
        </Dialog>
      </div>
      <SynthesisQueryPane
        isOpen={isDrawerOpen}
        close={onDrawerClose}
        blockUid={queryUid}
      />
    </div>
  );
};

export const render = ({ p, ...props }: { p: HTMLElement } & Props) =>
  ReactDOM.render(<CytoscapePlayground {...props} />, p);

export default CytoscapePlayground;
