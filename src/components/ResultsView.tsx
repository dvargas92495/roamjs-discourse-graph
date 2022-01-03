import React, { useMemo, useState } from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import { Result } from "../util";
import fuzzy from "fuzzy";
import { Button, Icon } from "@blueprintjs/core";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";

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
              <ul>
                {sortedResults.map((r) => (
                  <li key={r.uid}>
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
                              i % 2 === 0
                                ? ""
                                : "roamjs-discourse-hightlighted-result"
                            }
                          >
                            {s}
                          </span>
                        ))}
                      </a>
                      <ResultIcon result={r} />
                    </span>
                  </li>
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
