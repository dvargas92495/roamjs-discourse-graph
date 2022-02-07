import React, { useEffect, useMemo, useRef, useState } from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { Result } from "../util";
import fuzzy from "fuzzy";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { Button, Icon, Tooltip } from "@blueprintjs/core";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";

const SEARCH_HIGHLIGHT = "#C26313";

const SORT_OPTIONS: {
  label: string;
  fcn: (a: Result, b: Result) => number;
}[] = [
  { label: "TITLE A->Z", fcn: (a, b) => a.text.localeCompare(b.text) },
  { label: "TITLE Z->A", fcn: (a, b) => b.text.localeCompare(a.text) },
  { label: "YOUNGEST", fcn: (a, b) => a.createdTime - b.createdTime },
  { label: "OLDEST", fcn: (a, b) => b.createdTime - a.createdTime },
  { label: "EARLIEST", fcn: (a, b) => a.editedTime - b.editedTime },
  { label: "LATEST", fcn: (a, b) => b.editedTime - a.editedTime },
];
const SORT_FCN_BY_LABEL = Object.fromEntries(
  SORT_OPTIONS.map(({ label, fcn }) => [label, fcn])
);

const ResultView = ({
  ResultIcon,
  ...r
}: Result & {
  ResultIcon: (props: { result: Result }) => React.ReactElement;
}) => {
  const [contextOpen, setContextOpen] = useState(false);
  const contextPageTitle = useMemo(
    () => r.context && getPageTitleByPageUid(r.context),
    [r.context]
  );
  const contextBreadCrumbs = useMemo(
    () =>
      r.context
        ? window.roamAlphaAPI
            .q(
              `[:find (pull ?p [[:node/title :as "text"] [:block/string :as "text"] :block/uid]) :where 
              [?b :block/uid "${r.context}"]
              [?b :block/parents ?p]
            ]`
            )
            .map((a) => a[0] as { text: string; uid: string })
        : [],
    [r.context]
  );
  const contextChildren = useMemo(
    () =>
      r.context &&
      (contextPageTitle
        ? getShallowTreeByParentUid(r.context).map(({ uid }) => uid)
        : [r.context]),
    [r.context, contextPageTitle, r.uid]
  );
  const contextElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contextOpen) {
      setTimeout(() => {
        contextChildren.forEach((uid) => {
          window.roamAlphaAPI.ui.components.renderBlock({
            uid,
            el: contextElement.current.querySelector(`div[data-uid="${uid}"]`),
          });
        });
      }, 1);
    }
  }, [contextOpen, contextElement, r.uid, contextPageTitle]);
  return (
    <li>
      <span
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <a
          className={"rm-page-ref"}
          href={getRoamUrl(r.uid)}
          onClick={(e) => {
            if (e.ctrlKey || e.shiftKey) {
              openBlockInSidebar(r.uid);
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {r.text.split("<span>").map((s, i) => (
            <span
              key={i}
              className={
                i % 2 === 0 ? "" : "roamjs-discourse-hightlighted-result"
              }
            >
              {s}
            </span>
          ))}
        </a>
        <ResultIcon result={r} />
        {r.context && (
          <Tooltip content={"Context"}>
            <Button
              onClick={() => setContextOpen(!contextOpen)}
              active={contextOpen}
              style={{
                opacity: 0.5,
                fontSize: "0.8em",
                ...(contextOpen
                  ? { opacity: 1, color: "#8A9BA8", backgroundColor: "#F5F8FA" }
                  : {}),
              }}
              minimal
              icon="info-sign"
            />
          </Tooltip>
        )}
      </span>
      {contextOpen && (
        <div
          ref={contextElement}
          style={{
            position: "relative",
            backgroundColor: "#F5F8FA",
            padding: 16,
            maxHeight: 240,
            overflowY: "scroll",
          }}
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
            <div data-uid={uid}></div>
          ))}
        </div>
      )}
    </li>
  );
};

const ResultsView = ({
  Header,
  hideResults = false,
  results,
  ResultIcon = () => <span />,
  resultFilter = () => true,
  resultContent = <div />,
}: {
  Header: ({
    sortComponent,
  }: {
    sortComponent: React.ReactElement;
  }) => React.ReactElement;
  hideResults?: boolean;
  results: Result[];
  ResultIcon?: (props: { result: Result }) => React.ReactElement;
  resultFilter?: (r: Result) => boolean;
  resultContent?: React.ReactElement;
}) => {
  const [activeSort, setActiveSort] = useState(SORT_OPTIONS[0].label);
  const [searchTerm, setSearchTerm] = useState("");
  const sortedResults = useMemo(() => {
    const sorted = results
      .filter(resultFilter)
      .sort(SORT_FCN_BY_LABEL[activeSort]);
    return searchTerm
      ? sorted
          .map((s) => ({
            ...s,
            text:
              fuzzy.match(searchTerm, s.text, {
                pre: "<span>",
                post: "<span>",
              })?.rendered || s.text,
            hit: fuzzy.test(searchTerm, s.text),
          }))
          .filter((s) => s.hit)
      : sorted;
  }, [results, activeSort, searchTerm, resultFilter]);
  return (
    <div
      className="roamjs-discourse-results-view"
      style={{
        width: "100%",
      }}
    >
      <h4
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: 4,
        }}
      >
        <Header
          sortComponent={
            <MenuItemSelect
              popoverProps={{
                portalClassName: "roamjs-discourse-results-sort",
              }}
              ButtonProps={{ rightIcon: "sort" }}
              activeItem={activeSort}
              items={SORT_OPTIONS.map(({ label }) => label)}
              onItemSelect={(e) => setActiveSort(e)}
              className={"roamjs-discourse-results-sort"}
            />
          }
        />
      </h4>
      {!hideResults && (
        <div
          tabIndex={-1}
          style={{ position: "relative", outline: "none" }}
          onKeyDown={(e) => {
            if (!e.ctrlKey && !e.altKey && !e.metaKey) {
              if (e.key === "Backspace") {
                setSearchTerm(searchTerm.slice(0, -1));
              } else if (e.key.length === 1) {
                setSearchTerm(`${searchTerm}${e.key.toLowerCase()}`);
                if (e.key === " ") e.preventDefault();
              }
            }
          }}
        >
          <span
            style={{
              background: SEARCH_HIGHLIGHT,
              color: "white",
              position: "absolute",
              top: 4,
              right: 4,
              outline: sortedResults.length ? "unset" : "2px solid darkred",
            }}
          >
            {searchTerm}
          </span>
          {resultContent}
          {sortedResults.length ? (
            <>
              <i style={{ opacity: 0.8 }}>
                Showing {sortedResults.length} of {results.length} results
              </i>
              <ul
                style={{
                  maxHeight: "400px",
                  overflowY: "scroll",
                  paddingRight: 10,
                }}
              >
                {sortedResults.map((r) => (
                  <ResultView key={r.uid} {...r} ResultIcon={ResultIcon} />
                ))}
              </ul>
            </>
          ) : (
            <div>No Results</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsView;
