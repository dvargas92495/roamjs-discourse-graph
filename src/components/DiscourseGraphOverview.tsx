import {
  Alert,
  Button,
  Intent,
  Position,
  ProgressBar,
  Spinner,
  SpinnerSize,
  Tooltip,
} from "@blueprintjs/core";
import cytoscape from "cytoscape";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { getAllPageNames } from "roamjs-components";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import { getDataWorker, listeners } from "../dataWorkerClient";
import {
  getDiscourseContextResults,
  getNodes,
  getRelations,
  isNodeTitle,
} from "../util";
import { getExperimentalOverlayMode } from "./DiscourseContextOverlay";

type Props = {
  pageUid: string;
};

type CyData = {
  nodes: { label: string; id: string }[];
  edges: { source: string; label: string; target: string }[];
};

type LoadingProps = { resolve: (d: CyData) => void };

const LoadingDiscourseData = ({
  onClose,
  resolve,
}: { onClose: () => void } & LoadingProps) => {
  const [numPages, setNumPages] = useState(0);
  const allPages = useMemo(
    () => getAllPageNames().filter((p) => isNodeTitle(p)),
    []
  );
  const nodes = useMemo(getNodes, []);
  const relations = useMemo(getRelations, []);
  useEffect(() => {
    const cyNodes = new Set<string>();
    const edges: CyData["edges"] = [];

    Promise.all(
      allPages.map(
        (title, index) =>
          new Promise<void>((innerResolve) =>
            setTimeout(() => {
              const results = getDiscourseContextResults(
                title,
                nodes,
                relations
              );
              cyNodes.add(title);
              results.forEach((res) =>
                Object.values(res.results)
                  .filter((r) => !r.complement)
                  .forEach((r) => {
                    cyNodes.add(r.text);
                    edges.push({
                      source: title,
                      label: res.label,
                      target: r.text,
                    });
                  })
              );
              setNumPages(index + 1);
              innerResolve();
            }, 1)
          )
      )
    ).then(() => {
      onClose();
      resolve({
        edges,
        nodes: Array.from(cyNodes).map((id) => ({ id, label: id })),
      });
    });
  }, [onClose, allPages, nodes, relations]);
  return (
    <>
      <style>
        {`.roamjs-loading-alert .bp3-alert-footer {
  display: none;
}

.roamjs-loading-alert .bp3-alert-contents {
  margin:auto;
}

.roamjs-loading-alert.bp3-alert {
  max-width: fit-content;
}`}
      </style>
      <Alert
        isOpen={true}
        onClose={onClose}
        confirmButtonText={""}
        className={"roamjs-loading-alert"}
      >
        <div style={{ minWidth: 200, textAlign: "center" }}>
          <div>Currently loading discourse graph nodes.</div>
          <div>
            Loaded {numPages} of {allPages.length}...
          </div>
          <ProgressBar
            value={numPages / allPages.length}
            intent={Intent.SUCCESS}
          />
        </div>
      </Alert>
    </>
  );
};

const getCyData = (): Promise<CyData> => {
  if (getExperimentalOverlayMode()) {
    return new Promise((resolve) => {
      listeners["overview"] = (data: CyData) => resolve(data);
      getDataWorker().then((worker) =>
        worker.postMessage({ method: "overview" })
      );
    });
  } else {
    return new Promise((resolve) =>
      createOverlayRender<LoadingProps>(
        "loading discourse data",
        LoadingDiscourseData
      )({ resolve })
    );
  }
};

const DiscourseGraphOverview = ({ pageUid }: Props) => {
  const [maximized, setMaximized] = useState(false);
  const maximize = useCallback(() => setMaximized(true), [setMaximized]);
  const minimize = useCallback(() => setMaximized(false), [setMaximized]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core>(null);
  const edgeCallback = useCallback((edge: cytoscape.EdgeSingular) => {
    edge.on("click", () => {});
  }, []);
  useEffect(() => {
    getCyData().then((elements) => {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: [
          ...elements.nodes.map((data) => ({ data })),
          ...elements.edges.map((data) => ({
            data: {
              ...data,
              id: `${data.source}-${data.target}-${data.label}`,
            },
          })),
        ],
        style: [
          {
            selector: "node",
            style: {
              "background-color": `#333333`,
              label: "data(label)",
              shape: "round-rectangle",
              color: "#FFFFFF",
              "text-wrap": "wrap",
              "text-halign": "center",
              "text-valign": "center",
              "text-max-width": "40",
              width: 80,
              height: 80,
              "font-size": 8,
            },
          },
          {
            selector: "edge",
            style: {
              width: 6,
              "line-color": "#ccc",
              "target-arrow-color": "#ccc",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              label: "data(label)",
            },
          },
        ],

        layout: {
          name: "grid",
          spacingFactor: 1.5,
          padding: 16,
        },
        maxZoom: 100,
        minZoom: 0.01,
        zoom: 1,
      });
      const zoomedInNodes = new Set<cytoscape.NodeSingular>();
      cyRef.current.nodes().forEach((n: cytoscape.NodeSingular) => {
        n.on("click", () => {
          if (zoomedInNodes.has(n)) {
            zoomedInNodes.delete(n);
            n.style('background-color', '#333333');
          } else {
            zoomedInNodes.add(n);
            n.style('background-color', '#00008b');
          }
          const connectedNodes = new Set(
            Array.from(zoomedInNodes).flatMap((n) =>
              n
                .connectedEdges()
                .map((edge) =>
                  n === edge.source() ? edge.target() : edge.source()
                )
            )
          );
          zoomedInNodes.forEach((n) => connectedNodes.add(n));
          cyRef.current.nodes().forEach((other) => {
            if (!connectedNodes.size || connectedNodes.has(other)) {
              other.style("display", "element");
            } else {
              other.style("display", "none");
            }
          });
        });
      });
      cyRef.current.edges().forEach(edgeCallback);
    });
  }, [cyRef, containerRef, edgeCallback]);
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
        {maximized ? (
          <>
            <style>{`div.roam-body div.roam-app div.roam-main div.roam-article {\n  position: static;\n}`}</style>
            <Tooltip content={"Minimize"} position={Position.BOTTOM}>
              <Button icon={"minimize"} onClick={minimize} />
            </Tooltip>
          </>
        ) : (
          <Tooltip content={"Maximize"} position={Position.BOTTOM}>
            <Button icon={"maximize"} onClick={maximize} />
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export const render = ({ p, ...props }: { p: HTMLElement } & Props) =>
  ReactDOM.render(<DiscourseGraphOverview {...props} />, p);

export default DiscourseGraphOverview;
