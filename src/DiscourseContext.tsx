import {
  Button,
  Icon,
  Portal,
  Switch,
  Tabs,
  Tab,
  Tooltip,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { Result } from "roamjs-components/types/query-builder";
import { getDiscourseContextResults } from "./util";
import createQueryBuilderRender from "./utils/createQueryBuilderRender";
import nanoId from "nanoid";

type Props = {
  uid: string;
  results?: Awaited<ReturnType<typeof getDiscourseContextResults>>;
};

const ExtraColumnRow = (r: Result) => {
  const [contextOpen, setContextOpen] = useState(false);
  const [contextRowReady, setContextRowReady] = useState(false);
  const contextId = useMemo(nanoId, []);
  const anchorId = useMemo(nanoId, []);
  const [anchorOpen, setAnchorOpen] = useState(false);
  const [anchorRowReady, setAnchorRowReady] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const contextPageTitle = useMemo(
    () =>
      r["context-uid"] && getPageTitleByPageUid(r["context-uid"].toString()),
    [r["context-uid"]]
  );
  const contextBreadCrumbs = useMemo(
    () =>
      r["context-uid"]
        ? window.roamAlphaAPI
            .q(
              `[:find (pull ?p [:node/title :block/string :block/uid]) :where 
              [?b :block/uid "${r["context-uid"]}"]
              [?b :block/parents ?p]
            ]`
            )
            .map(
              (a) => a[0] as { string?: string; title?: string; uid: string }
            )
            .map((a) => ({ uid: a.uid, text: a.string || a.title || "" }))
        : [],
    [r["context-uid"]]
  );
  const contextChildren = useMemo(
    () =>
      r["context-uid"] &&
      (contextPageTitle
        ? getShallowTreeByParentUid(r["context-uid"].toString()).map(
            ({ uid }) => uid
          )
        : [r["context-uid"].toString()]),
    [r["context-uid"], contextPageTitle, r.uid]
  );
  useEffect(() => {
    if (contextOpen) {
      const row = containerRef.current.closest("tr");
      const contextElement = document.createElement("tr");
      const contextTd = document.createElement("td");
      contextTd.colSpan = row.childElementCount;
      contextElement.id = contextId;
      row.parentElement.insertBefore(contextElement, row.nextElementSibling);
      contextElement.append(contextTd);
      setContextRowReady(true);
    } else {
      setContextRowReady(false);
      document.getElementById(contextId)?.remove();
    }
  }, [contextOpen, setContextRowReady, contextId]);
  useEffect(() => {
    if (contextRowReady) {
      setTimeout(() => {
        contextChildren.forEach((uid) => {
          window.roamAlphaAPI.ui.components.renderBlock({
            uid,
            el: document.querySelector(
              `tr#${contextId} div[data-uid="${uid}"]`
            ),
          });
        });
      }, 1);
    }
  }, [contextRowReady]);
  useEffect(() => {
    if (anchorOpen) {
      const row = containerRef.current.closest("tr");
      const anchorElement = document.createElement("tr");
      const anchorTd = document.createElement("td");
      anchorTd.colSpan = row.childElementCount;
      anchorElement.id = anchorId;
      row.parentElement.insertBefore(anchorElement, row.nextElementSibling);
      anchorElement.append(anchorTd);
      setAnchorRowReady(true);
    } else {
      setAnchorRowReady(false);
      document.getElementById(anchorId)?.remove();
    }
  }, [anchorOpen, setAnchorRowReady, anchorId]);
  return (
    <span ref={containerRef}>
      {r["context-uid"] && (
        <Tooltip content={"Context"}>
          <Button
            onClick={() => setContextOpen(!contextOpen)}
            small
            active={contextOpen}
            style={{
              opacity: 0.5,
              fontSize: "0.8em",
              ...(contextOpen
                ? {
                    opacity: 1,
                    color: "#8A9BA8",
                    backgroundColor: "#F5F8FA",
                  }
                : {}),
            }}
            minimal
            icon="info-sign"
          />
        </Tooltip>
      )}
      <style>
        {`#${contextId} td,
#${anchorId} td {
  position: relative;
  background-color: #F5F8FA;
  padding: 16px;
  max-height: 240px;
  overflow-y: scroll;
}
#${contextId} .bp3-portal,
#${anchorId} .bp3-portal {
  position: relative;
}`}
      </style>
      {contextRowReady && (
        <Portal
          container={
            document.getElementById(contextId)
              ?.firstElementChild as HTMLDataElement
          }
          className={"relative"}
        >
          {contextPageTitle ? (
            <h3 style={{ margin: 0 }}>{contextPageTitle}</h3>
          ) : (
            <div className="rm-zoom">
              {contextBreadCrumbs.map((bc) => (
                <div key={bc.uid} className="rm-zoom-item">
                  <span className="rm-zoom-item-content">{bc.text}</span>
                  <Icon icon={"chevron-right"} />
                </div>
              ))}
            </div>
          )}
          {contextChildren.map((uid) => (
            <div data-uid={uid} key={uid}></div>
          ))}
        </Portal>
      )}
      {r.anchor && (
        <Tooltip content={"See Related Relations"}>
          <Button
            onClick={() => setAnchorOpen(!anchorOpen)}
            active={anchorOpen}
            small
            style={{
              opacity: 0.5,
              fontSize: "0.8em",
              ...(anchorOpen
                ? {
                    opacity: 1,
                    color: "#8A9BA8",
                    backgroundColor: "#F5F8FA",
                  }
                : {}),
            }}
            minimal
            icon={"resolve"}
          />
        </Tooltip>
      )}
      {anchorRowReady && (
        <Portal
          container={
            document.getElementById(anchorId)
              ?.firstElementChild as HTMLDataElement
          }
        >
          <ContextContent uid={r["anchor-uid"] as string} />
        </Portal>
      )}
    </span>
  );
};

const ContextTab = ({
  parentUid,
  r,
  groupByTarget,
  setGroupByTarget,
}: {
  parentUid: string;
  r: Props["results"][number];
  groupByTarget: boolean;
  setGroupByTarget: (b: boolean) => void;
}) => {
  const [subTabId, setSubTabId] = useState(0);
  const hasExtra = useMemo(
    () =>
      Object.values(r.results).some((r: Result) => !!(r.context || r.anchor)),
    [r]
  );
  const subTabs = useMemo(
    () =>
      groupByTarget
        ? Array.from(
            new Set(Object.values(r.results).map((res) => res.target))
          ).sort()
        : [],
    [groupByTarget, r.results]
  );
  const getFilteredResults = useCallback(
    (id) =>
      Object.entries(r.results).filter(([, res]) => res.target === subTabs[id]),
    [subTabs, r.results]
  );
  const results = useMemo(
    () =>
      groupByTarget
        ? Object.fromEntries(getFilteredResults(subTabId))
        : r.results,
    [groupByTarget, r.results, subTabId, getFilteredResults]
  );
  const { ResultsView } = window.roamjs.extension.queryBuilder;
  const resultsView = (
    <ResultsView
      preventSavingSettings
      parentUid={parentUid}
      results={Object.values(results).map(
        ({ target, complement, id, ...a }) =>
          a as Parameters<typeof ResultsView>[0]["results"][number]
      )}
      header={
        <>
          <span>{r.label}</span>
          <span style={{ display: "flex", alignItems: "center" }}>
            <Switch
              label="Group By Target"
              checked={groupByTarget}
              style={{ fontSize: 8, marginLeft: 4, marginBottom: 0 }}
              onChange={(e) =>
                setGroupByTarget((e.target as HTMLInputElement).checked)
              }
            />
          </span>
        </>
      }
      // @ts-ignore
      extraColumn={
        hasExtra
          ? {
              width: 72,
              header: <Icon icon={"data-connection"} />,
              row: ExtraColumnRow,
              reserve: [/anchor/, /context/],
            }
          : undefined
      }
    />
  );
  return subTabs.length ? (
    <Tabs
      selectedTabId={subTabId}
      onChange={(e) => setSubTabId(Number(e))}
      vertical
    >
      {subTabs.map((target, j) => (
        <Tab
          key={j}
          id={j}
          title={`(${getFilteredResults(j).length}) ${target}`}
          panelClassName="roamjs-discourse-result-panel"
          panel={resultsView}
        />
      ))}
    </Tabs>
  ) : (
    resultsView
  );
};

export const ContextContent = ({ uid, results }: Props) => {
  const [queryResults, setQueryResults] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (results ? Promise.resolve(results) : getDiscourseContextResults({ uid }))
      .then((q) =>
        setQueryResults(q.filter((r) => !!Object.keys(r.results).length))
      )
      .finally(() => setLoading(false));
  }, [uid, results, setQueryResults, setLoading]);
  const [tabId, setTabId] = useState(0);
  const [groupByTarget, setGroupByTarget] = useState(false);
  return queryResults.length ? (
    <>
      <style>{`.roamjs-discourse-result-panel .roamjs-query-results-header {
  padding-top: 0;
}`}</style>
      <Tabs
        selectedTabId={tabId}
        onChange={(e) => setTabId(Number(e))}
        vertical
      >
        {queryResults.map((r, i) => (
          <Tab
            id={i}
            key={i}
            title={`(${Object.values(r.results).length}) ${r.label}`}
            panelClassName="roamjs-discourse-result-panel"
            panel={
              <ContextTab
                key={i}
                parentUid={uid}
                r={r}
                groupByTarget={groupByTarget}
                setGroupByTarget={setGroupByTarget}
              />
            }
          />
        ))}
      </Tabs>
    </>
  ) : loading ? (
    <div>Loading discourse relations...</div>
  ) : (
    <div>No discourse relations found.</div>
  );
};

const DiscourseContext = ({ uid }: Props) => {
  const [caretShown, setCaretShown] = useState(false);
  const [caretOpen, setCaretOpen] = useState(false);
  return (
    <>
      <div
        className={"flex-h-box"}
        onMouseEnter={() => setCaretShown(true)}
        onMouseLeave={() => setCaretShown(false)}
        style={{ marginBottom: 4 }}
      >
        <span
          className={`bp3-icon-standard bp3-icon-caret-down rm-caret ${
            caretOpen ? "rm-caret-open" : "rm-caret-closed"
          } ${
            caretShown ? "rm-caret-showing" : "rm-caret-hidden"
          } dont-focus-block`}
          onClick={() => setCaretOpen(!caretOpen)}
        />
        <div style={{ flex: "0 1 2px" }} />
        <div style={{ color: "rgb(206, 217, 224)" }}>
          <strong>Discourse Context</strong>
        </div>
      </div>
      <div style={{ paddingLeft: 16 }}>
        {caretOpen && <ContextContent uid={uid} />}
      </div>
    </>
  );
};

export const render = createQueryBuilderRender(DiscourseContext);

export default DiscourseContext;
