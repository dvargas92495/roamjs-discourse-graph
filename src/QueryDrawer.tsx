import {
  Button,
  H3,
  H6,
  Icon,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  PopoverPosition,
} from "@blueprintjs/core";
import { render as exportRender } from "./ExportDialog";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createBlock,
  deleteBlock,
  getBasicTreeByParentUid,
  getCurrentPageUid,
  getPageTitleByPageUid,
  getPageUidByPageTitle,
  getRoamUrl,
  getTextByBlockUid,
  openBlockInSidebar,
  toRoamDateUid,
  updateBlock,
} from "roam-client";
import {
  createOverlayRender,
  getSettingValueFromTree,
  getSettingValuesFromTree,
  getSubTree,
  MenuItemSelect,
  PageInput,
  setInputSetting,
  toFlexRegex,
  useArrowKeyDown,
} from "roamjs-components";
import ResizableDrawer from "./ResizableDrawer";
import {
  englishToDatalog,
  getNodes,
  getRelations,
  triplesToQuery,
} from "./util";
import fuzzy from "fuzzy";

type Props = {
  blockUid: string;
  clearOnClick: (s: string, m: string) => void;
};

type Condition = {
  relation: string;
  source: string;
  target: string;
  uid: string;
};

const ANY_REGEX = /Has Any Relation To/i;

const QueryCondition = ({
  con,
  index,
  setConditions,
  conditions,
  relationLabels,
  returnNode,
}: {
  con: Condition;
  index: number;
  setConditions: (cons: Condition[]) => void;
  conditions: Condition[];
  relationLabels: string[];
  returnNode: string;
}) => {
  const debounceRef = useRef(0);
  return (
    <div style={{ display: "flex", margin: "8px 0", alignItems: "baseline" }}>
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-discourse-condition-relation",
        }}
        activeItem={con.source}
        items={Array.from(
          new Set(conditions.slice(0, index).map((c) => c.target))
        ).concat(returnNode)}
        onItemSelect={(value) => {
          setInputSetting({
            blockUid: con.uid,
            key: "source",
            value,
          });
          setConditions(
            conditions.map((c) =>
              c.uid === con.uid ? { ...con, source: value } : c
            )
          );
        }}
      />
      <MenuItemSelect
        popoverProps={{
          className: "roamjs-discourse-condition-relation",
        }}
        activeItem={con.relation}
        onItemSelect={(relation) => {
          setInputSetting({
            blockUid: con.uid,
            key: "Relation",
            value: relation,
            index: 1,
          });
          setConditions(
            conditions.map((c) =>
              c.uid === con.uid ? { ...con, relation } : c
            )
          );
        }}
        items={relationLabels}
        emptyValueText={"Choose relationship"}
        ButtonProps={{
          style: {
            minWidth: 144,
            width: 144,
            margin: "0 8px",
            display: "flex",
            justifyContent: "space-between",
          },
        }}
      />
      <div style={{ flexGrow: 1 }}>
        <PageInput
          value={con.target}
          setValue={(e) => {
            window.clearTimeout(debounceRef.current);
            setConditions(
              conditions.map((c) =>
                c.uid === con.uid ? { ...con, target: e } : c
              )
            );
            debounceRef.current = window.setTimeout(() => {
              setInputSetting({
                blockUid: con.uid,
                value: e,
                key: "target",
                index: 2,
              });
            }, 1000);
          }}
        />
      </div>
      <Button
        icon={"trash"}
        onClick={() => {
          deleteBlock(con.uid);
          setConditions(conditions.filter((c) => c.uid !== con.uid));
        }}
        minimal
        style={{ alignSelf: "end" }}
      />
    </div>
  );
};

type SearchResult = {
  text: string;
  pageUid: string;
  createdTime: number;
  editedTime: number;
};

const SORT_OPTIONS: {
  label: string;
  fcn: (a: SearchResult, b: SearchResult) => number;
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
export const SEARCH_HIGHLIGHT = "#C26313";

const SavedQuery = ({
  uid,
  clearOnClick,
  onDelete,
  resultsReferenced,
  setResultsReferenced,
  editSavedQuery,
  parseQuery,
}: {
  uid: string;
  clearOnClick: (s: string, t: string) => void;
  onDelete: () => void;
  resultsReferenced: Set<string>;
  setResultsReferenced: (s: Set<string>) => void;
  editSavedQuery: (s: string[]) => void;
  parseQuery: (s: string[]) => {
    returnNode: string;
    conditionNodes: Omit<Condition, "uid">[];
  };
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), []);
  const [minimized, setMinimized] = useState(false);
  const [label, setLabel] = useState(() => getTextByBlockUid(uid));
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const results = useMemo(
    () =>
      window.roamAlphaAPI
        .q(
          `[:find ?u (pull ?p [
      [:node/title :as "text"]
      [:create/time :as "createdTime"]
      [:edit/time :as "editedTime"]
    ]) (pull ?c [:block/uid]) :where [?b :block/uid "${
      getSubTree({ tree, key: "results" })?.uid
    }"] [?b :block/children ?c] [?c :block/string ?u] [?p :block/uid ?u]]`
        )
        .map(
          (r) =>
            ({ pageUid: r[0], ...r[1], ...r[2] } as SearchResult & {
              uid: string;
            })
        ),
    []
  );
  const query = useMemo(
    () => getSettingValuesFromTree({ tree, key: "query" }),
    []
  );
  const returnNode = /^Find (.*) Where$/.exec(query[0])?.[1];
  const [activeSort, setActiveSort] = useState(SORT_OPTIONS[0].label);
  const [searchTerm, setSearchTerm] = useState("");
  const sortedResults = useMemo(() => {
    const sorted = results
      .filter((r) => !resultsReferenced.has(r.text))
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
  }, [results, activeSort, searchTerm, resultsReferenced]);
  return (
    <div
      style={{
        border: "1px solid gray",
        borderRadius: 4,
        padding: 4,
        margin: 4,
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
        {isEditingLabel ? (
          <InputGroup
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateBlock({ uid, text: label });
                setIsEditingLabel(false);
              }
            }}
            autoFocus
            rightElement={
              <Button
                minimal
                icon={"confirm"}
                onClick={() => {
                  updateBlock({ uid, text: label });
                  setIsEditingLabel(false);
                }}
              />
            }
          />
        ) : (
          <span tabIndex={-1} onClick={() => setIsEditingLabel(true)}>
            {label}
          </span>
        )}
        <div>
          <MenuItemSelect
            popoverProps={{ portalClassName: "roamjs-discourse-results-sort" }}
            ButtonProps={{ rightIcon: "sort" }}
            activeItem={activeSort}
            items={SORT_OPTIONS.map(({ label }) => label)}
            onItemSelect={(e) => setActiveSort(e)}
            className={"roamjs-discourse-results-sort"}
          />
          <Button
            icon={"export"}
            minimal
            onClick={() =>
              exportRender({
                fromQuery: {
                  results: results.map(({ text, pageUid }) => ({
                    title: text,
                    uid: pageUid,
                  })),
                  conditions: parseQuery(query).conditionNodes.map((c) => ({
                    predicate: {
                      title: c.target,
                      uid: getPageUidByPageTitle(c.target),
                    },
                    relation: c.relation,
                  })),
                },
              })
            }
          />
          <Button
            icon={minimized ? "maximize" : "minimize"}
            onClick={() => setMinimized(!minimized)}
            active={minimized}
            minimal
          />
          <Button icon={"cross"} onClick={onDelete} minimal />
        </div>
      </h4>
      {!minimized && (
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
          <div style={{ fontSize: 10, position: "relative" }}>
            <Button
              icon={<Icon icon={"edit"} iconSize={12} />}
              minimal
              style={{
                height: 12,
                width: 12,
                minHeight: 12,
                minWidth: 12,
                padding: 2,
                position: "absolute",
                top: 0,
                right: 8,
              }}
              onClick={() => {
                editSavedQuery(query);
                onDelete();
              }}
            />
            {query.map((q, i) => (
              <p key={i} style={{ margin: 0 }}>
                {q}
              </p>
            ))}
          </div>
          {sortedResults.length ? (
            <>
              <i style={{ opacity: 0.8 }}>
                Showing {sortedResults.length} of {results.length} results
              </i>
              <ul>
                {sortedResults.map((r) => (
                  <li key={r.pageUid}>
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
                        href={getRoamUrl(r.pageUid)}
                        onClick={(e) => {
                          if (e.ctrlKey || e.shiftKey) {
                            openBlockInSidebar(r.pageUid);
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
                      <Button
                        icon={"hand-right"}
                        minimal
                        onClick={() => {
                          setResultsReferenced(
                            new Set([...Array.from(resultsReferenced), r.text])
                          );
                          clearOnClick?.(r.text, returnNode);
                        }}
                      />
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

const SavedQueriesContainer = ({
  savedQueries,
  setSavedQueries,
  clearOnClick,
  editSavedQuery,
  parseQuery,
}: {
  savedQueries: string[];
  setSavedQueries: (s: string[]) => void;
  clearOnClick: (s: string, t: string) => void;
  editSavedQuery: (s: string[]) => void;
  parseQuery: (s: string[]) => {
    returnNode: string;
    conditionNodes: Omit<Condition, "uid">[];
  };
}) => {
  const refreshResultsReferenced = useCallback(
    (pageUid = getCurrentPageUid()) => {
      const title = getPageTitleByPageUid(pageUid);
      if (title.startsWith("Playground")) {
        return new Set(
          window.roamAlphaAPI
            .q(
              `[:find (pull ?c [:block/string]) :where 
            [?p :block/uid "${pageUid}"] 
            [?e :block/page ?p] 
            [?e :block/string "elements"] 
            [?e :block/children ?c]]`
            )
            .filter((a) => a.length && a[0])
            .map((a) => a[0].string)
        );
      }
      return new Set(
        window.roamAlphaAPI
          .q(
            `[:find (pull ?r [:node/title]) :where 
            [?p :block/uid "${pageUid}"] 
            [?b :block/page ?p] 
            [?b :block/refs ?r]]`
          )
          .filter((a) => a.length && a[0])
          .map((a) => a[0].title)
      );
    },
    []
  );
  const [resultsReferenced, setResultsReferenced] = useState(
    refreshResultsReferenced
  );
  const hashChangeListener = useCallback(
    (e: HashChangeEvent) =>
      setResultsReferenced(
        refreshResultsReferenced(
          e.newURL.match(/\/page\/(.*)$/)?.[1] || toRoamDateUid(new Date())
        )
      ),
    [refreshResultsReferenced, setResultsReferenced]
  );
  useEffect(() => {
    window.addEventListener("hashchange", hashChangeListener);
    return () => window.removeEventListener("hashchange", hashChangeListener);
  }, [hashChangeListener]);
  return (
    <>
      <hr />
      <H3>Saved Queries</H3>
      {savedQueries.map((sq) => (
        <SavedQuery
          uid={sq}
          key={sq}
          clearOnClick={clearOnClick}
          onDelete={() => {
            setSavedQueries(savedQueries.filter((s) => s !== sq));
            deleteBlock(sq);
          }}
          resultsReferenced={resultsReferenced}
          setResultsReferenced={setResultsReferenced}
          editSavedQuery={editSavedQuery}
          parseQuery={parseQuery}
        />
      ))}
    </>
  );
};

const QueryDrawerContent = ({ clearOnClick, blockUid }: Props) => {
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), []);
  const discourseNodes = useMemo(getNodes, []);
  const nodeFormatByLabel = useMemo(
    () => Object.fromEntries(discourseNodes.map((n) => [n.text, n.format])),
    [discourseNodes]
  );
  const nodeLabelByType = useMemo(
    () => Object.fromEntries(discourseNodes.map((n) => [n.type, n.text])),
    [discourseNodes]
  );
  const nodeTypeByLabel = useMemo(
    () =>
      Object.fromEntries(
        discourseNodes.map((n) => [n.text.toLowerCase(), n.type])
      ),
    [discourseNodes]
  );
  const discourseRelations = useMemo(getRelations, []);
  const scratchNode = useMemo(
    () => tree.find((t) => toFlexRegex("scratch").test(t.text)),
    [tree]
  );
  const scratchNodeUid = useMemo(
    () =>
      scratchNode?.uid ||
      createBlock({ node: { text: "scratch" }, parentUid: blockUid }),
    [scratchNode, blockUid]
  );
  const scratchNodeChildren = useMemo(
    () => scratchNode?.children || [],
    [scratchNode]
  );
  const [isReturnSuggestionsOpen, setIsReturnSuggestionsOpen] = useState(false);
  const openReturnSuggestions = useCallback(
    () => setIsReturnSuggestionsOpen(true),
    [setIsReturnSuggestionsOpen]
  );
  const closeReturnSuggestions = useCallback(
    () => setIsReturnSuggestionsOpen(false),
    [setIsReturnSuggestionsOpen]
  );
  const [returnNode, setReturnNode] = useState(
    getSettingValueFromTree({
      tree: scratchNodeChildren,
      key: "return",
    })
  );
  const returnSuggestions = useMemo(
    () =>
      returnNode
        ? discourseNodes.filter(({ text }) => text.startsWith(returnNode))
        : [],
    [discourseNodes, returnNode]
  );

  const conditionsNode = useMemo(
    () =>
      scratchNodeChildren.find((t) => toFlexRegex("conditions").test(t.text)),
    [scratchNodeChildren]
  );
  const conditionsNodeUid = useMemo(
    () =>
      conditionsNode?.uid ||
      createBlock({ node: { text: "conditions" }, parentUid: scratchNodeUid }),
    [conditionsNode, scratchNodeUid]
  );
  const conditionsNodeChildren = useMemo(
    () => conditionsNode?.children || [],
    [conditionsNode]
  );
  const [conditions, setConditions] = useState<Condition[]>(() => {
    return conditionsNodeChildren.map(({ uid, children }) => ({
      uid,
      source: "",
      target: "",
      relation: "",
      ...Object.fromEntries(
        children.map((c) => [c.text.toLowerCase(), c.children?.[0]?.text])
      ),
    }));
  });
  const debounceRef = useRef(0);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const translator = useMemo(englishToDatalog, []);
  const fireQuery = useCallback(() => {
    const where = conditions
      .flatMap((c) => {
        const native = translator[c.relation];
        const conditionTarget =
          nodeTypeByLabel[c.target.toLowerCase()] || c.target;
        if (native) return native(c.source, conditionTarget);
        const filteredRelations = discourseRelations
          .map((r) =>
            (r.label === c.relation || ANY_REGEX.test(c.relation)) &&
            (nodeLabelByType[r.source].startsWith(c.source) ||
              r.destination === conditionTarget)
              ? { ...r, forward: true }
              : (nodeLabelByType[r.destination].startsWith(c.source) ||
                  r.source === conditionTarget) &&
                (r.complement === c.relation || ANY_REGEX.test(c.relation))
              ? { ...r, forward: false }
              : undefined
          )
          .filter((r) => !!r);
        if (!filteredRelations.length) return "";
        return `(or-join [?${c.source}] ${filteredRelations.map(
          ({ triples, source, destination, forward }) => {
            const queryTriples = triples.map((t) => t.slice(0));
            const sourceTriple = queryTriples.find((t) => t[2] === "source");
            const destinationTriple = queryTriples.find(
              (t) => t[2] === "destination"
            );
            if (!sourceTriple || !destinationTriple) return "";
            let returnNodeVar = "";
            if (forward) {
              destinationTriple[1] = "Has Title";
              destinationTriple[2] = conditionTarget;
              sourceTriple[2] = source;
              if (nodeLabelByType[source].startsWith(returnNode)) {
                returnNodeVar = sourceTriple[0];
              }
            } else {
              sourceTriple[1] = "Has Title";
              sourceTriple[2] = conditionTarget;
              destinationTriple[2] = destination;
              if (nodeLabelByType[destination].startsWith(returnNode)) {
                returnNodeVar = destinationTriple[0];
              }
            }
            const subQuery = triplesToQuery(queryTriples, translator);
            const andQuery = `\n  (and ${subQuery.replace(
              /([\s|\[]\?)/g,
              `$1${c.uid}-`
            )})`;
            return returnNodeVar
              ? andQuery.replace(
                  new RegExp(`\\?${c.uid}-${returnNodeVar}`, "g"),
                  `?${returnNode}`
                )
              : andQuery;
          }
        )}\n)`;
      })
      .join("\n");
    const query = `[:find (pull ?${returnNode} [
      [:block/string :as "text"] 
      [:node/title :as "text"] 
      [:block/uid :as "pageUid"]
      [:create/time :as "createdTime"]
      [:edit/time :as "editedTime"]
    ]) :where ${where}]`;
    try {
      const results = where
        ? window.roamAlphaAPI.q(query).map((a) => a[0] as SearchResult)
        : [];
      setResults(results);
    } catch (e) {
      console.error("Error from Roam:");
      console.error(e.message);
      console.error("Query from Roam:");
      console.error(query);
      setResults([]);
    }
    setShowResults(true);
  }, [setShowResults, setResults, conditions, returnNode, nodeFormatByLabel]);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnNodeOnChange = (value: string) => {
    window.clearTimeout(debounceRef.current);
    setReturnNode(value);
    debounceRef.current = window.setTimeout(() => {
      setInputSetting({
        blockUid: scratchNodeUid,
        value,
        key: "return",
      });
    }, 1000);
  };
  const { activeIndex, onKeyDown } = useArrowKeyDown({
    onEnter: (value) => {
      if (isReturnSuggestionsOpen) {
        returnNodeOnChange(value.text);
        closeReturnSuggestions();
      }
    },
    results: returnSuggestions,
  });
  const [savedQueries, setSavedQueries] = useState<string[]>(
    tree.filter((t) => !toFlexRegex("scratch").test(t.text)).map((t) => t.uid)
  );
  const [savedQueryLabel, setSavedQueryLabel] = useState(
    `Query ${
      savedQueries.reduce(
        (prev, cur) =>
          prev < Number(cur.split(" ")[1]) ? Number(cur.split(" ")[1]) : prev,
        0
      ) + 1
    }`
  );
  const relationLabels = useMemo(
    () =>
      Array.from(
        new Set(
          Object.keys(translator).concat(
            discourseRelations.flatMap((r) => [r.label, r.complement])
          )
        )
      )
        .sort()
        .concat(ANY_REGEX.source),
    [translator, discourseRelations]
  );

  const parseQuery = useCallback(
    (q: string[]) => {
      const [findWhere, ...conditions] = q;
      const returnNode = findWhere.split(" ")[1];
      const conditionNodes = conditions.map((c) => {
        const [source, rest] = c.split(/ (.+)/);
        const relation = relationLabels.find((l) => rest.startsWith(l));
        const target = rest.substring(relation.length + 1);
        return {
          source,
          relation,
          target,
        };
      });
      return { returnNode, conditionNodes };
    },
    [relationLabels]
  );
  const editSavedQuery = useCallback(
    (q: string[]) => {
      const { returnNode: value, conditionNodes } = parseQuery(q);
      setInputSetting({
        blockUid: scratchNodeUid,
        value,
        key: "return",
      });
      const conditionNodesWithUids = conditionNodes.map(
        ({ source, relation, target }, order) => {
          return {
            source,
            relation,
            target,
            uid: createBlock({
              parentUid: conditionsNodeUid,
              order,
              node: {
                text: `${order}`,
                children: [
                  { text: "source", children: [{ text: source }] },
                  { text: "relation", children: [{ text: relation }] },
                  { text: "target", children: [{ text: target }] },
                ],
              },
            }),
          };
        }
      );
      setTimeout(() => {
        setReturnNode(value);
        setConditions(conditionNodesWithUids);
      }, 1);
    },
    [relationLabels, setReturnNode, setConditions]
  );
  return (
    <>
      <H6
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{ minWidth: 92, display: "inline-block", textAlign: "center" }}
        >
          Find
        </span>
        <Popover
          captureDismiss
          isOpen={isReturnSuggestionsOpen}
          onOpened={openReturnSuggestions}
          minimal
          position={PopoverPosition.BOTTOM_LEFT}
          content={
            !!returnSuggestions.length && (
              <Menu style={{ maxWidth: 400 }}>
                {returnSuggestions.map((t, i) => (
                  <MenuItem
                    text={t.text}
                    active={activeIndex === i}
                    key={i}
                    multiline
                    onClick={() => {
                      setReturnNode(t.text);
                      closeReturnSuggestions();
                      inputRef.current?.focus();
                    }}
                  />
                ))}
              </Menu>
            )
          }
          target={
            <InputGroup
              value={returnNode}
              onKeyDown={onKeyDown}
              onChange={(e) => {
                returnNodeOnChange(e.target.value);
                openReturnSuggestions();
              }}
              placeholder={"Enter Label..."}
            />
          }
        />
        <span
          style={{ minWidth: 92, display: "inline-block", textAlign: "center" }}
        >
          Where
        </span>
      </H6>
      {conditions.map((con, index) => (
        <QueryCondition
          key={con.uid}
          relationLabels={relationLabels}
          con={con}
          index={index}
          conditions={conditions}
          returnNode={returnNode}
          setConditions={setConditions}
        />
      ))}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button
          rightIcon={"plus"}
          text={"Add Condition"}
          onClick={() => {
            const uid = createBlock({
              parentUid: conditionsNodeUid,
              order: conditions.length,
              node: {
                text: `${conditions.length}`,
              },
            });
            setConditions([
              ...conditions,
              { uid, source: "", relation: "", target: "" },
            ]);
          }}
        />
        <Button
          text={"Query"}
          onClick={() => {
            fireQuery();
          }}
          intent={"primary"}
          disabled={
            !conditions.length ||
            !conditions.every((c) => !!c.relation && !!c.target) ||
            !returnNode
          }
        />
      </div>
      {showResults && (
        <>
          <hr />
          <H3 style={{ display: "flex", justifyContent: "space-between" }}>
            Results
            <div>
              <Button
                icon={"pin"}
                onClick={() => {
                  const newSavedUid = createBlock({
                    node: {
                      text: savedQueryLabel,
                      children: [
                        {
                          text: "results",
                          children: results.map((r) => ({
                            text: r.pageUid,
                            children: [
                              { text: r.text },
                              { text: r.createdTime.toString() },
                              { text: r.editedTime.toString() },
                            ],
                          })),
                        },
                        {
                          text: "query",
                          children: [
                            { text: `Find ${returnNode} Where` },
                            ...conditions.map((c) => ({
                              text: `${c.source} ${c.relation} ${c.target}`,
                            })),
                          ],
                        },
                      ],
                    },
                    parentUid: blockUid,
                  });
                  conditions.forEach((c) => deleteBlock(c.uid));
                  setInputSetting({
                    blockUid: scratchNodeUid,
                    value: "",
                    key: "return",
                  });

                  setTimeout(() => {
                    setSavedQueryLabel(
                      // temporary
                      savedQueryLabel
                        .split(" ")
                        .map((s) => (s === "Query" ? s : `${Number(s) + 1}`))
                        .join(" ")
                    );
                    setReturnNode("");
                    setConditions([]);
                    setSavedQueries([...savedQueries, newSavedUid]);
                    setShowResults(false);
                    setResults([]);
                  }, 1);
                }}
                minimal
              />
              <Button
                icon={"cross"}
                onClick={() => {
                  setShowResults(false);
                  setResults([]);
                }}
                minimal
              />
            </div>
          </H3>
          {results.length ? (
            <>
              <i style={{ opacity: 0.8 }}>Found {results.length} results</i>
              <ul>
                {results.map((r) => (
                  <li key={r.pageUid}>
                    <span
                      style={{
                        display: "flex",
                        width: "100%",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <a
                        className={"rm-page-ref"}
                        href={getRoamUrl(r.pageUid)}
                        onClick={(e) => {
                          if (e.ctrlKey || e.shiftKey) {
                            openBlockInSidebar(r.pageUid);
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                      >
                        {r.text}
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div>No Results</div>
          )}
        </>
      )}
      {!!savedQueries.length && (
        <SavedQueriesContainer
          savedQueries={savedQueries}
          setSavedQueries={setSavedQueries}
          clearOnClick={clearOnClick}
          editSavedQuery={editSavedQuery}
          parseQuery={parseQuery}
        />
      )}
    </>
  );
};

const QueryDrawer = ({
  onClose,
  ...props
}: {
  onClose: () => void;
} & Props) => (
  <ResizableDrawer onClose={onClose} title={"Queries"}>
    <QueryDrawerContent {...props} />
  </ResizableDrawer>
);

export const render = createOverlayRender<Props>("query-drawer", QueryDrawer);

export default QueryDrawer;
