import { Button, Position, Tooltip } from "@blueprintjs/core";
import cytoscape from "cytoscape";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  getDataWorker,
  initializeDataWorker,
  listeners,
} from "../dataWorkerClient";
import { getExperimentalOverlayMode } from "./DiscourseContextOverlay";

type Props = {
  pageUid: string;
};

type CyData = {
  nodes: { label: string; id: string }[];
  edges: { source: number; label: string; target: number }[];
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
    return Promise.resolve({ nodes: [], edges: [] });
  }
};

const DiscourseGraphOverview = ({ pageUid }: Props) => {
  const [maximized, setMaximized] = useState(false);
  const maximize = useCallback(() => setMaximized(true), [setMaximized]);
  const minimize = useCallback(() => setMaximized(false), [setMaximized]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core>(null);
  const nodeCallback = useCallback((n: cytoscape.NodeSingular) => {
    n.on("click", () => {});
  }, []);
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
              "text-max-width": "160",
              width: 40,
              height: 40,
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
          name: "random",
        },
        maxZoom: 200,
        minZoom: 0.25,
        zoom: 1
      });
      cyRef.current.nodes().forEach(nodeCallback);
      cyRef.current.edges().forEach(edgeCallback);
    });
  }, [cyRef, containerRef, nodeCallback, edgeCallback]);
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
