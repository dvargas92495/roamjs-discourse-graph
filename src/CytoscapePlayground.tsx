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
  Label,
  Tooltip,
} from "@blueprintjs/core";
import {
  createBlock,
  getFirstChildTextByBlockUid,
  getPageUidByPageTitle,
  getShallowTreeByParentUid,
} from "roam-client";
import { setInputSetting, toFlexRegex } from "roamjs-components";

type Props = {
  title: string;
};

const CytoscapePlayground = ({ title }: Props) => {
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core>(null);
  const sourceRef = useRef<cytoscape.NodeSingular>(null);
  const tree = useMemo(() => getShallowTreeByParentUid(pageUid), [pageUid]);
  const elementsUid = useMemo(
    () =>
      tree.find((t) => toFlexRegex("elements").test(t.text))?.uid ||
      createBlock({ node: { text: "elements" }, parentUid: pageUid }),
    [tree]
  );
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
  return (
    <div
      style={{ width: "100%", height: "100%", border: "1px solid gray" }}
      ref={containerRef}
    >
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
        <Tooltip content={"Add Node"}>
          <Button icon={"circle"} onClick={onOpen} />
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
    </div>
  );
};

export const render = ({ p, ...props }: { p: HTMLElement } & Props) =>
  ReactDOM.render(<CytoscapePlayground {...props} />, p);

export default CytoscapePlayground;
