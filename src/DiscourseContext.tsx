import { Switch, Tabs, Tab } from "@blueprintjs/core";
import React, { useCallback, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import ResultsView from "./components/ResultsView";
import { getDiscourseContextResults, Result } from "./util";

type Props = {
  title: string;
  results?: ReturnType<typeof getDiscourseContextResults>;
};

const ContextTab = ({
  r,
  groupByTarget,
  setGroupByTarget,
}: {
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
  const resultsView = (
    <ResultsView
      results={Object.values(results).map((a) => ({
        context: a.context,
        uid: a.uid || "",
        text: a.text || "",
        createdTime: new Date(a.createdTime),
        editedTime: new Date(a.editedTime),
      }))}
      header={() => (
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
      )}
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

export const ContextContent = ({ title, results }: Props) => {
  const queryResults = useMemo(
    () =>
      (results || getDiscourseContextResults(title)).filter(
        (r) => !!Object.keys(r.results).length
      ),
    [title, results]
  );
  const [tabId, setTabId] = useState(0);
  const [groupByTarget, setGroupByTarget] = useState(false);
  return queryResults.length ? (
    <Tabs selectedTabId={tabId} onChange={(e) => setTabId(Number(e))} vertical>
      {queryResults.map((r, i) => (
        <Tab
          id={i}
          key={i}
          title={`(${Object.values(r.results).length}) ${r.label}`}
          panelClassName="roamjs-discourse-result-panel"
          panel={
            <ContextTab
              key={i}
              r={r}
              groupByTarget={groupByTarget}
              setGroupByTarget={setGroupByTarget}
            />
          }
        />
      ))}
    </Tabs>
  ) : (
    <div>No discourse relations found.</div>
  );
};

const DiscourseContext = ({ title }: Props) => {
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
        {caretOpen && <ContextContent title={title} />}
      </div>
    </>
  );
};

export const render = ({ p, ...props }: { p: HTMLDivElement } & Props) =>
  ReactDOM.render(<DiscourseContext {...props} />, p);

export default DiscourseContext;
