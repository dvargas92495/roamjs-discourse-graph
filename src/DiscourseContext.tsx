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
  const [anchorOpen, setAnchorOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const contextPageTitle = useMemo(
    () => r.context && getPageTitleByPageUid(r.context.toString()),
    [r.context]
  );
  const contextBreadCrumbs = useMemo(
    () =>
      r.context
        ? window.roamAlphaAPI
            .q(
              `[:find (pull ?p [:node/title :block/string :block/uid]) :where 
              [?b :block/uid "${r.context}"]
              [?b :block/parents ?p]
            ]`
            )
            .map(
              (a) => a[0] as { string?: string; title?: string; uid: string }
            )
            .map((a) => ({ uid: a.uid, text: a.string || a.title || "" }))
        : [],
    [r.context]
  );
  const contextChildren = useMemo(
    () =>
      r.context &&
      (contextPageTitle
        ? getShallowTreeByParentUid(r.context.toString()).map(({ uid }) => uid)
        : [r.context.toString()]),
    [r.context, contextPageTitle, r.uid]
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
  }, [contextOpen, r.uid, contextPageTitle, setContextRowReady, contextId]);
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
  return (
    <span ref={containerRef}>
      {r.context && (
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
        {`#${contextId} td {
          position: relative;
          background-color: #F5F8FA;
          padding: 16px;
          max-height: 240px;
          overflow-y: scroll;
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
      extraColumn={{
        width: 60,
        header: <Icon icon={"data-connection"} />,
        row: ExtraColumnRow,
      }}
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
