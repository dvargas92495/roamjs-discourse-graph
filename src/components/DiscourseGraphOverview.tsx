import {
  Alert,
  Button,
  Intent,
  Popover,
  Position,
  ProgressBar,
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
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import { getDataWorker, listeners } from "../dataWorkerClient";
import {
  getDiscourseContextResults,
  getNodes,
  getRelations,
  isNodeTitle,
  matchNode,
} from "../util";
import { getExperimentalOverlayMode } from "./DiscourseContextOverlay";

type Props = {
  pageUid: string;
};

type CyData = {
  elements: {
    nodes: { label: string; id: string; filterId: string }[];
    edges: { source: string; label: string; target: string; id: string }[];
  };
  config: {
    nodes: ReturnType<typeof getNodes>;
    relations: Omit<
      ReturnType<typeof getRelations>[number],
      "triples" | "complement"
    >[];
  };
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
    const edges: CyData["elements"]["edges"] = [];

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
                  .filter((r) => !r.complement && title !== r.text)
                  .forEach((r) => {
                    cyNodes.add(r.text);
                    edges.push({
                      source: title,
                      label: res.label,
                      target: r.text,
                      id: r.id,
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
        elements: {
          edges,
          nodes: Array.from(cyNodes).map((id) => ({
            id,
            label: id,
            filterId: nodes.find((n) =>
              matchNode({ format: n.format, title: id })
            )?.type,
          })),
        },
        config: { nodes, relations },
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
  const [filterSearch, setFilterSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const openFilter = useCallback(
    () => setIsFilterOpen(true),
    [setIsFilterOpen]
  );
  const closeFilter = useCallback(
    () => setIsFilterOpen(false),
    [setIsFilterOpen]
  );
  const filtersRef = useRef({
    includes: {
      nodes: new Set(),
      edges: new Set(),
    },
    excludes: {
      nodes: new Set(),
      edges: new Set(),
    },
  });
  const [filters, setFilters] = useState(filtersRef.current);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core>(null);
  const edgeCallback = useCallback((edge: cytoscape.EdgeSingular) => {
    edge.on("click", () => {});
  }, []);
  const [config, setConfig] = useState<CyData["config"]>({
    nodes: [],
    relations: [],
  });
  const configNodeLabels = useMemo(
    () => Object.fromEntries(config.nodes.map((n) => [n.type, n.text])),
    [config.nodes]
  );
  const zoomedInNodes = useRef(new Set<cytoscape.NodeSingular>());
  const refreshCy = useCallback(() => {
    const connectedNodes = new Set(
      Array.from(zoomedInNodes.current).flatMap((n) =>
        n
          .connectedEdges()
          .map((edge) => (n === edge.source() ? edge.target() : edge.source()))
      )
    );
    zoomedInNodes.current.forEach((n) => connectedNodes.add(n));
    cyRef.current.nodes().forEach((other) => {
      if (
        ((filtersRef.current.includes.nodes.size === 0 &&
          !filtersRef.current.excludes.nodes.has(other.data("filterId"))) ||
          filtersRef.current.includes.nodes.has(other.data("filterId"))) &&
        (!connectedNodes.size || connectedNodes.has(other))
      ) {
        other.style("display", "element");
      } else {
        other.style("display", "none");
      }
    });
    cyRef.current.edges().forEach((other) => {
      if (
        (filtersRef.current.includes.edges.size === 0 &&
          !filtersRef.current.excludes.edges.has(other.data("filterId"))) ||
        filtersRef.current.includes.edges.has(other.data("filterId"))
      ) {
        other.style("display", "element");
      } else {
        other.style("display", "none");
      }
    });
  }, [cyRef, zoomedInNodes, filtersRef]);
  useEffect(() => {
    getCyData().then(({ elements, config }) => {
      setConfig({
        nodes: config.nodes,
        relations: Object.entries(
          Object.fromEntries(
            // WARNING: Misleading type! config.relations is actually the output of getRelations();
            config.relations.map((r) => [
              r.id,
              { source: r.source, destination: r.destination, label: r.label },
            ])
          )
        ).map(([id, r]) => ({ id, ...r })),
      });
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: [
          ...elements.nodes.map((data) => ({ data })),
          ...elements.edges.map((data) => ({
            data: {
              ...data,
              id: `${data.source}-${data.target}-${data.label}`,
              filterId: data.id,
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
      const eventContext: {
        clicked?: cytoscape.NodeSingular;
        timeout: number;
      } = {
        clicked: undefined,
        timeout: 0,
      };
      cyRef.current.nodes().forEach((n: cytoscape.NodeSingular) => {
        const doubleClick = () => {
          if (zoomedInNodes.current.has(n)) {
            zoomedInNodes.current.delete(n);
            n.style("background-color", "#333333");
          } else {
            zoomedInNodes.current.add(n);
            n.style("background-color", "#00008b");
          }

          refreshCy();
        };
        const singleClick = (e: cytoscape.EventObject) => {
          if (e.originalEvent.shiftKey) {
            openBlockInSidebar(getPageUidByPageTitle(n.data("label")));
          } else {
            window.roamAlphaAPI.ui.mainWindow.openPage({
              page: { title: n.data("label") },
            });
          }
        };
        n.on("click", (e) => {
          clearTimeout(eventContext.timeout);
          if (eventContext.clicked === n) {
            eventContext.clicked = undefined;
            doubleClick();
          } else {
            eventContext.clicked = n;
            eventContext.timeout = window.setTimeout(() => {
              eventContext.clicked = undefined;
              singleClick(e);
            }, 500);
          }
        });
      });
      cyRef.current.edges().forEach(edgeCallback);
    });
  }, [cyRef, containerRef, edgeCallback, refreshCy, zoomedInNodes]);
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
        <Tooltip content={"Filters"} position={Position.BOTTOM}>
          <Popover
            target={
              <Button
                icon={"filter"}
                onClick={openFilter}
                style={{ marginRight: 8 }}
              />
            }
            content={
              <div
                style={{ maxWidth: 600, maxHeight: 245, overflowY: "scroll" }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: 500,
                    maxWidth: "90vw",
                    transition: "all 300ms ease-in 0s",
                    padding: 8,
                  }}
                >
                  <div className="flex-h-box">
                    <div
                      style={{
                        flex: "1 1 100%",
                        paddingTop: 4,
                        paddingBottom: 4,
                        paddingLeft: 4,
                      }}
                    >
                      <div>
                        <strong>Includes</strong>
                        <span style={{ marginLeft: 4, fontSize: 12 }}>
                          Click to Add
                        </span>
                        <div
                          style={{
                            padding: "8px 0px",
                            fontSize: "0.8em",
                            color: "rgb(167, 182, 194)",
                          }}
                        >
                          {filters.includes.nodes.size === 0 &&
                          filters.includes.edges.size === 0 ? (
                            "Only include these nodes/relations"
                          ) : (
                            <>
                              {config.nodes
                                .filter((n) =>
                                  filters.includes.nodes.has(n.type)
                                )
                                .map((n) => (
                                  <div
                                    style={{
                                      position: "relative",
                                      display: "inline-block",
                                    }}
                                    key={n.type}
                                  >
                                    <div>
                                      <button
                                        className="bp3-button"
                                        style={{
                                          margin: 4,
                                          paddingRight: 4,
                                          cursor: "pointer",
                                          borderBottomColor:
                                            "rgb(92, 112, 128)",
                                        }}
                                        onClick={(e) => {
                                          filtersRef.current.includes.nodes.delete(
                                            n.type
                                          );
                                          setFilters({ ...filtersRef.current });
                                          refreshCy();
                                        }}
                                      >
                                        {n.text}
                                        <sub
                                          style={{
                                            marginLeft: 3,
                                            marginTop: 3,
                                          }}
                                        >
                                          {n.shortcut}
                                        </sub>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              {config.relations
                                .filter((n) => filters.includes.edges.has(n.id))
                                .map((r) => (
                                  <div
                                    style={{
                                      position: "relative",
                                      display: "inline-block",
                                    }}
                                    key={r.id}
                                  >
                                    <div>
                                      <button
                                        className="bp3-button"
                                        style={{
                                          margin: 4,
                                          paddingRight: 4,
                                          cursor: "pointer",
                                          borderBottomColor:
                                            "rgb(92, 112, 128)",
                                        }}
                                        onClick={(e) => {
                                          filtersRef.current.includes.edges.delete(
                                            r.id
                                          );
                                          setFilters({ ...filtersRef.current });
                                          refreshCy();
                                        }}
                                      >
                                        {r.label}
                                        <sub
                                          style={{
                                            marginLeft: 3,
                                            marginTop: 3,
                                          }}
                                        >
                                          {configNodeLabels[r.source]}
                                          {" => "}
                                          {configNodeLabels[r.destination]}
                                        </sub>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ paddingTop: 8 }} />
                    </div>
                    <div
                      className="rm-line"
                      style={{ marginTop: 8, marginBottom: 8 }}
                    />
                    <div
                      style={{
                        flex: "1 1 100%",
                        paddingTop: 4,
                        paddingBottom: 4,
                        paddingLeft: 8,
                      }}
                    >
                      <div>
                        <strong>Removes</strong>
                        <span style={{ marginLeft: 4, fontSize: 12 }}>
                          Shift-Click to Add
                        </span>
                        <div
                          style={{
                            padding: "8px 0px",
                            fontSize: "0.8em",
                            color: "rgb(167, 182, 194)",
                          }}
                        >
                          {filters.excludes.nodes.size === 0 &&
                          filters.excludes.edges.size === 0 ? (
                            "Hide these types of nodes/relations"
                          ) : (
                            <>
                              {config.nodes
                                .filter((n) =>
                                  filters.excludes.nodes.has(n.type)
                                )
                                .map((n) => (
                                  <div
                                    style={{
                                      position: "relative",
                                      display: "inline-block",
                                    }}
                                    key={n.type}
                                  >
                                    <div>
                                      <button
                                        className="bp3-button"
                                        style={{
                                          margin: 4,
                                          paddingRight: 4,
                                          cursor: "pointer",
                                          borderBottomColor:
                                            "rgb(92, 112, 128)",
                                        }}
                                        onClick={() => {
                                          filtersRef.current.excludes.nodes.delete(
                                            n.type
                                          );
                                          setFilters({ ...filtersRef.current });
                                          refreshCy();
                                        }}
                                      >
                                        {n.text}
                                        <sub
                                          style={{
                                            marginLeft: 3,
                                            marginTop: 3,
                                          }}
                                        >
                                          {n.shortcut}
                                        </sub>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              {config.relations
                                .filter((n) => filters.excludes.edges.has(n.id))
                                .map((r) => (
                                  <div
                                    style={{
                                      position: "relative",
                                      display: "inline-block",
                                    }}
                                    key={r.id}
                                  >
                                    <div>
                                      <button
                                        className="bp3-button"
                                        style={{
                                          margin: 4,
                                          paddingRight: 4,
                                          cursor: "pointer",
                                          borderBottomColor:
                                            "rgb(92, 112, 128)",
                                        }}
                                        onClick={() => {
                                          filtersRef.current.excludes.edges.delete(
                                            r.id
                                          );
                                          setFilters({ ...filtersRef.current });
                                          refreshCy();
                                        }}
                                      >
                                        {r.label}
                                        <sub
                                          style={{
                                            marginLeft: 3,
                                            marginTop: 3,
                                          }}
                                        >
                                          {configNodeLabels[r.source]}
                                          {" => "}
                                          {configNodeLabels[r.destination]}
                                        </sub>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ paddingTop: 8 }} />
                    </div>
                  </div>
                  <div
                    className="rm-line"
                    style={{ marginTop: 4, borderColor: "rgb(41, 55, 66)" }}
                  />
                  <input
                    placeholder="Search References"
                    className="bp3-input bp3-minimal search-input"
                    style={{ margin: 8 }}
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                  />
                  <div className="flex-h-box">
                    <div
                      style={{
                        flex: "1 1 100%",
                        paddingTop: 4,
                        paddingBottom: 4,
                        paddingLeft: 4,
                      }}
                    >
                      {config.nodes
                        .filter(
                          (n) =>
                            !filters.includes.nodes.has(n.type) &&
                            !filters.excludes.nodes.has(n.type)
                        )
                        .map((n) => (
                          <div
                            style={{
                              position: "relative",
                              display: "inline-block",
                            }}
                            key={n.type}
                          >
                            <div>
                              <button
                                className="bp3-button"
                                style={{
                                  margin: 4,
                                  paddingRight: 4,
                                  cursor: "pointer",
                                  borderBottomColor: "rgb(92, 112, 128)",
                                }}
                                onClick={(e) => {
                                  if (e.shiftKey)
                                    filtersRef.current.excludes.nodes.add(
                                      n.type
                                    );
                                  else
                                    filtersRef.current.includes.nodes.add(
                                      n.type
                                    );
                                  setFilters({ ...filtersRef.current });
                                  refreshCy();
                                }}
                              >
                                {n.text}
                                <sub style={{ marginLeft: 3, marginTop: 3 }}>
                                  {n.shortcut}
                                </sub>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                    <div
                      className="rm-line"
                      style={{ marginTop: 8, marginBottom: 8 }}
                    />
                    <div
                      style={{
                        flex: "1 1 100%",
                        paddingTop: 4,
                        paddingBottom: 4,
                        paddingLeft: 4,
                      }}
                    >
                      {config.relations
                        .filter(
                          (n) =>
                            !filters.includes.edges.has(n.id) &&
                            !filters.excludes.nodes.has(n.id)
                        )
                        .map((r) => (
                          <div
                            style={{
                              position: "relative",
                              display: "inline-block",
                            }}
                            key={r.id}
                          >
                            <div>
                              <button
                                className="bp3-button"
                                style={{
                                  margin: 4,
                                  paddingRight: 4,
                                  cursor: "pointer",
                                  borderBottomColor: "rgb(92, 112, 128)",
                                }}
                                onClick={(e) => {
                                  if (e.shiftKey)
                                    filtersRef.current.excludes.edges.add(r.id);
                                  else
                                    filtersRef.current.includes.edges.add(r.id);
                                  setFilters({ ...filtersRef.current });
                                  refreshCy();
                                }}
                              >
                                {r.label}
                                <sub style={{ marginLeft: 3, marginTop: 3 }}>
                                  {configNodeLabels[r.source]}
                                  {" => "}
                                  {configNodeLabels[r.destination]}
                                </sub>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            }
            onClose={closeFilter}
            isOpen={isFilterOpen}
          />
        </Tooltip>
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
