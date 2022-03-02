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
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import toRoamDateUid from "roamjs-components/date/toRoamDateUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSettingValuesFromTree from "roamjs-components/util/getSettingValuesFromTree";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import PageInput from "roamjs-components/components/PageInput";
import setInputSetting from "roamjs-components/util/setInputSetting";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import useArrowKeyDown from "roamjs-components/hooks/useArrowKeyDown";
import ResizableDrawer from "./ResizableDrawer";
import {
  englishToDatalog,
  getNodes,
  getRelations,
  matchNode,
  Result,
  triplesToQuery,
} from "./util";
import ResultsView, { Result as SearchResult } from "./components/ResultsView";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";

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

type Selection = {
  text: string;
  label: string;
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
          className: "roamjs-discourse-condition-source",
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
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          },
        }}
      />
      <div className="roamjs-discourse-condition-target">
        <span style={{ flexGrow: 1 }}>
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
        </span>
        <Button
          icon={"trash"}
          onClick={() => {
            deleteBlock(con.uid);
            setConditions(conditions.filter((c) => c.uid !== con.uid));
          }}
          minimal
          style={{ alignSelf: "end", minWidth: 30 }}
        />
      </div>
    </div>
  );
};

const QuerySelection = ({
  sel,
  setSelections,
  selections,
}: {
  sel: Selection;
  setSelections: (cons: Selection[]) => void;
  selections: Selection[];
}) => {
  const debounceRef = useRef(0);
  return (
    <div style={{ display: "flex", margin: "8px 0", alignItems: "center" }}>
      <span
        style={{
          minWidth: 144,
          display: "inline-block",
          fontWeight: 600,
        }}
      >
        AS
      </span>
      <div style={{ minWidth: 144, paddingRight: 8, maxWidth: 144 }}>
        <InputGroup
          value={sel.label}
          onChange={(e) => {
            window.clearTimeout(debounceRef.current);
            setSelections(
              selections.map((c) =>
                c.uid === sel.uid ? { ...sel, label: e.target.value } : c
              )
            );
            debounceRef.current = window.setTimeout(() => {
              const firstChild = getFirstChildUidByBlockUid(sel.uid);
              if (firstChild) updateBlock({ uid: firstChild, text: sel.label });
              else
                createBlock({ parentUid: sel.uid, node: { text: sel.label } });
            }, 1000);
          }}
        />
      </div>
      <div style={{ flexGrow: 1, display: "flex", minWidth: 300, alignItems: 'center' }}>
        <span
          style={{
            minWidth: 56,
            display: "inline-block",
            fontWeight: 600,
          }}
        >
          Select
        </span>
        <div style={{ flexGrow: 1 }}>
          <InputGroup
            value={sel.text}
            style={{ width: "100%" }}
            onChange={(e) => {
              window.clearTimeout(debounceRef.current);
              setSelections(
                selections.map((c) =>
                  c.uid === sel.uid ? { ...sel, text: e.target.value } : c
                )
              );
              debounceRef.current = window.setTimeout(() => {
                updateBlock({ uid: sel.uid, text: sel.text });
              }, 1000);
            }}
          />
        </div>
        <Button
          icon={"trash"}
          onClick={() => {
            deleteBlock(sel.uid).then(() =>
              setSelections(selections.filter((c) => c.uid !== sel.uid))
            );
          }}
          minimal
          style={{ alignSelf: "end", minWidth: 30 }}
        />
      </div>
    </div>
  );
};

const SavedQuery = ({
  uid,
  onDelete,
  parseQuery,
  fireQuery,
  resultsReferenced,
  clearOnClick,
  setResultsReferenced,
  editSavedQuery,
  initialResults,
}: {
  uid: string;
  parseQuery: (s: string[]) => {
    returnNode: string;
    conditionNodes: Condition[];
    selectionNodes: Selection[];
  };
  fireQuery: (args: {
    returnNode: string;
    conditions: Condition[];
    selections: Selection[];
  }) => SearchResult[];
  onDelete: () => void;
  resultsReferenced: Set<string>;
  clearOnClick: (s: string, t: string) => void;
  setResultsReferenced: (s: Set<string>) => void;
  editSavedQuery: (s: string[]) => void;
  initialResults?: SearchResult[];
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), []);
  const query = useMemo(
    () => getSettingValuesFromTree({ tree, key: "query" }),
    []
  );
  const [results, setResults] = useState<SearchResult[]>(initialResults || []);
  const resultFilter = useCallback(
    (r: Result) => !resultsReferenced.has(r.text),
    [resultsReferenced]
  );
  const [minimized, setMinimized] = useState(!initialResults);
  const [initialQuery, setInitialQuery] = useState(!!initialResults);
  const [label, setLabel] = useState(() => getTextByBlockUid(uid));
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const { returnNode, conditionNodes, selectionNodes } = useMemo(
    () => parseQuery(query),
    [parseQuery, query]
  );
  useEffect(() => {
    if (!initialQuery && !minimized) {
      setInitialQuery(true);
      const results = fireQuery({
        returnNode,
        conditions: conditionNodes,
        selections: selectionNodes,
      });
      setResults(results);
    }
  }, [initialQuery, minimized, setInitialQuery, setResults, parseQuery]);
  return (
    <div
      style={{
        border: "1px solid gray",
        borderRadius: 4,
        padding: 4,
        margin: 4,
      }}
    >
      <ResultsView
        header={
          <>
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
              <Button
                icon={"export"}
                minimal
                onClick={() => {
                  const conditions = parseQuery(query).conditionNodes.map(
                    (c) => ({
                      predicate: {
                        title: c.target,
                        uid: getPageUidByPageTitle(c.target),
                      },
                      relation: c.relation,
                    })
                  );
                  exportRender({
                    fromQuery: {
                      nodes: results
                        .map(({ text, uid }) => ({
                          title: text,
                          uid,
                        }))
                        .concat(
                          conditions
                            .map((c) => c.predicate)
                            .filter((c) => !!c.uid)
                        ),
                    },
                  });
                }}
              />
              <Button
                icon={minimized ? "maximize" : "minimize"}
                onClick={() => setMinimized(!minimized)}
                active={minimized}
                minimal
              />
              <Button icon={"cross"} onClick={onDelete} minimal />
            </div>
          </>
        }
        hideResults={minimized}
        results={results.map(({ id, ...a }) => a)}
        resultFilter={resultFilter}
        ResultIcon={({ result: r }) => (
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
        )}
        resultContent={
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
        }
      />
    </div>
  );
};

const predefinedSelections: {
  test: RegExp;
  text: string;
  mapper: (r: SearchResult, key: string) => SearchResult[string];
}[] = [
  {
    test: /created?\s*date/i,
    text: '[:create/time :as "createdTime"]',
    mapper: (r) => {
      const value = new Date(r.createdTime);
      delete r.createdTime;
      return value;
    },
  },
  {
    test: /edit(ed)?\s*date/i,
    text: '[:edit/time :as "editedTime"]',
    mapper: (r) => {
      const value = new Date(r.editedTime);
      delete r.editedTime;
      return value;
    },
  },
  {
    test: /author/i,
    text: '[:create/user :as "author"]',
    mapper: (r) => {
      const value = window.roamAlphaAPI.pull(
        "[:user/display-name]",
        r.author as number
      )[":user/display-name"];
      delete r.author;
      return value;
    },
  },
  {
    test: /.*/,
    text: "",
    mapper: (r, key) => {
      return (
        window.roamAlphaAPI.q(
          `[:find (pull ?b [:block/string]) :where [?a :node/title "${normalizePageTitle(
            key
          )}"] [?p :block/uid "${
            r.uid
          }"] [?b :block/refs ?a] [?b :block/page ?p]]`
        )?.[0]?.[0]?.string || ""
      )
        .slice(key.length + 2)
        .trim();
    },
  },
];

const SavedQueriesContainer = ({
  savedQueries,
  setSavedQueries,
  clearOnClick,
  editSavedQuery,
  parseQuery,
  fireQuery,
}: {
  savedQueries: { uid: string; text: string; results?: SearchResult[] }[];
  setSavedQueries: (
    s: { uid: string; text: string; results?: SearchResult[] }[]
  ) => void;
  clearOnClick: (s: string, t: string) => void;
  editSavedQuery: (s: string[]) => void;
  parseQuery: (s: string[]) => {
    returnNode: string;
    conditionNodes: Condition[];
    selectionNodes: Selection[];
  };
  fireQuery: (args: {
    returnNode: string;
    conditions: Condition[];
    selections: Selection[];
  }) => SearchResult[];
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
          uid={sq.uid}
          key={sq.uid}
          clearOnClick={clearOnClick}
          onDelete={() => {
            setSavedQueries(savedQueries.filter((s) => s !== sq));
            deleteBlock(sq.uid);
          }}
          resultsReferenced={resultsReferenced}
          setResultsReferenced={setResultsReferenced}
          editSavedQuery={editSavedQuery}
          parseQuery={parseQuery}
          fireQuery={fireQuery}
          initialResults={sq.results}
        />
      ))}
    </>
  );
};

const QueryDrawerContent = ({
  clearOnClick,
  blockUid,
  ...exportRenderProps
}: Props) => {
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), []);
  const discourseNodes = useMemo(getNodes, []);
  const nodeFormatByLabel = useMemo(
    () => Object.fromEntries(discourseNodes.map((n) => [n.text, n.format])),
    [discourseNodes]
  );
  const nodeFormatByType = useMemo(
    () => Object.fromEntries(discourseNodes.map((n) => [n.type, n.format])),
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
  const scratchNodeUid = useMemo(() => {
    if (scratchNode?.uid) return scratchNode?.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text: "scratch", uid: newUid },
      parentUid: blockUid,
    });
    return newUid;
  }, [scratchNode, blockUid]);
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
  const conditionsNodeUid = useMemo(() => {
    if (conditionsNode?.uid) return conditionsNode?.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text: "conditions", uid: newUid },
      parentUid: scratchNodeUid,
    });
    return newUid;
  }, [conditionsNode, scratchNodeUid]);
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

  const selectionsNode = useMemo(
    () =>
      scratchNodeChildren.find((t) => toFlexRegex("selections").test(t.text)),
    [scratchNodeChildren]
  );
  const selectionsNodeUid = useMemo(() => {
    if (selectionsNode?.uid) return selectionsNode?.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text: "selections", uid: newUid },
      parentUid: scratchNodeUid,
    });
    return newUid;
  }, [selectionsNode, scratchNodeUid]);
  const selectionsNodeChildren = useMemo(
    () => selectionsNode?.children || [],
    [selectionsNode]
  );
  const [selections, setSelections] = useState<Selection[]>(() => {
    return selectionsNodeChildren.map(({ uid, text, children }) => ({
      uid,
      text,
      label: children?.[0]?.text || "",
    }));
  });

  const debounceRef = useRef(0);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const translator = useMemo(englishToDatalog, []);
  const fireQuery = useCallback(
    ({
      conditions,
      returnNode,
      selections,
    }: {
      returnNode: string;
      conditions: Condition[];
      selections: Selection[];
    }) => {
      const where = conditions
        .flatMap((c) => {
          const native = translator[c.relation];
          const targetType = nodeTypeByLabel[c.target.toLowerCase()];
          if (native) {
            if (/is a/.test(c.relation)) {
              return native(c.source, targetType);
            }
            const sourceType = nodeTypeByLabel[c.source.toLowerCase()];
            const prefix = sourceType
              ? translator["is a"](c.source, sourceType)
              : "";
            const suffix = targetType
              ? translator["is a"](c.target, targetType)
              : "";
            return `${prefix}${native(c.source, c.target)}${suffix}`;
          }
          const doesRelationMatchCondition = (
            relation: { source: string; destination: string },
            condition: { source: string; target: string }
          ) => {
            const sourceMatches =
              nodeLabelByType[relation.source] === condition.source;
            const targetMatches =
              relation.destination === nodeLabelByType[condition.target] ||
              matchNode({
                format: nodeFormatByType[relation.destination],
                title: condition.target,
              });
            if (sourceMatches) {
              return (
                targetMatches ||
                (!nodeTypeByLabel[condition.target.toLowerCase()] &&
                  Object.values(nodeFormatByType).every(
                    (format) => !matchNode({ format, title: condition.target })
                  ))
              );
            }
            if (targetMatches) {
              return (
                sourceMatches ||
                !nodeTypeByLabel[condition.source.toLowerCase()]
              );
            }
            return false;
          };
          const conditionTarget = targetType || c.target;
          const filteredRelations = discourseRelations
            .map((r) =>
              (r.label === c.relation || ANY_REGEX.test(c.relation)) &&
              doesRelationMatchCondition(r, c)
                ? { ...r, forward: true }
                : doesRelationMatchCondition(
                    { source: r.destination, destination: r.source },
                    c
                  ) &&
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
              let sourceNodeVar = "";
              if (forward) {
                destinationTriple[1] = "Has Title";
                destinationTriple[2] = conditionTarget;
                sourceTriple[2] = source;
                sourceNodeVar = sourceTriple[0];
              } else {
                sourceTriple[1] = "Has Title";
                sourceTriple[2] = conditionTarget;
                destinationTriple[2] = destination;
                sourceNodeVar = destinationTriple[0];
              }
              const subQuery = triplesToQuery(queryTriples, translator);
              const andQuery = `\n  (and ${subQuery.replace(
                /([\s|\[]\?)/g,
                `$1${c.uid}-`
              )})`;
              return andQuery.replace(
                new RegExp(`\\?${c.uid}-${sourceNodeVar}`, "g"),
                `?${c.source}`
              );
            }
          )}\n)`;
        })
        .join("\n");

      const definedSelections = selections
        .map((s) => ({
          defined: predefinedSelections.find((p) => p.test.test(s.text)),
          s,
        }))
        .filter((p) => !!p.defined);
      const morePullSelections = definedSelections
        .map((p) => p.defined.text)
        .join("\n");
      // const attributePulls =
      const query = `[:find (pull ?${returnNode} [
      :block/string
      :node/title
      :block/uid
      ${morePullSelections}
    ]) :where ${where}]`;
      try {
        const results = where
          ? window.roamAlphaAPI.q(query).map(
              (a) =>
                a[0] as {
                  title?: string;
                  string?: string;
                  uid: string;
                  [k: string]: string | number;
                }
            )
          : [];
        return results
          .map(
            ({ title, string: s, ...r }) =>
              ({ ...r, text: s || title || "" } as SearchResult)
          )
          .map((r) =>
            definedSelections.reduce((p, c) => {
              p[c.s.label || c.s.text] = c.defined.mapper(p, c.s.text);
              return p;
            }, r)
          );
      } catch (e) {
        console.error("Error from Roam:");
        console.error(e.message);
        console.error("Query from Roam:");
        console.error(query);
        return [];
      }
    },
    [setResults, nodeFormatByLabel]
  );
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
  const [savedQueries, setSavedQueries] = useState<
    { text: string; uid: string; results?: SearchResult[] }[]
  >(
    tree
      .filter((t) => !toFlexRegex("scratch").test(t.text))
      .map((t) => ({ text: t.text, uid: t.uid }))
  );
  const [savedQueryLabel, setSavedQueryLabel] = useState(
    `Query ${
      savedQueries.reduce(
        (prev, cur) =>
          prev < Number(cur.text.split(" ")[1])
            ? Number(cur.text.split(" ")[1])
            : prev,
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
      const conditionNodes = conditions
        .filter((s) => !s.startsWith("Select"))
        .map((c) => {
          const [source, rest] = c.split(/ (.+)/);
          const relation = relationLabels.find((l) => rest.startsWith(l));
          const target = rest.substring(relation.length + 1);
          return {
            source,
            relation,
            target,
            uid: window.roamAlphaAPI.util.generateUID(),
          };
        });
      const selectionNodes = conditions
        .filter((s) => s.startsWith("Select"))
        .map((s) =>
          s
            .replace(/^Select/i, "")
            .trim()
            .split(" AS ")
        )
        .map(([text, label]) => ({
          uid: window.roamAlphaAPI.util.generateUID(),
          text,
          label,
        }));
      return { returnNode, conditionNodes, selectionNodes };
    },
    [relationLabels]
  );
  const editSavedQuery = useCallback(
    (q: string[]) => {
      const {
        returnNode: value,
        conditionNodes,
        selectionNodes,
      } = parseQuery(q);
      setInputSetting({
        blockUid: scratchNodeUid,
        value,
        key: "return",
      });
      Promise.all([
        Promise.all(
          conditionNodes.map(({ source, relation, target }, order) =>
            createBlock({
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
            }).then((uid) => ({
              source,
              relation,
              target,
              uid,
            }))
          )
        ),
        Promise.all(
          selectionNodes.map((sel, order) =>
            createBlock({
              parentUid: selectionsNodeUid,
              order,
              node: {
                text: sel.text,
                uid: sel.uid,
                children: [{ text: sel.label }],
              },
            }).then(() => sel)
          )
        ),
      ]).then(([conditionNodesWithUids, selections]) => {
        setReturnNode(value);
        setConditions(conditionNodesWithUids);
        setSelections(selections);
      });
    },
    [
      relationLabels,
      setReturnNode,
      setConditions,
      conditionsNodeUid,
      selectionsNodeUid,
      setSelections,
      scratchNodeUid,
    ]
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
          style={{
            minWidth: 144,
            display: "inline-block",
          }}
        >
          Find
        </span>
        <Popover
          popoverClassName={"roamjs-discourse-return-node"}
          className="roamjs-discourse-return-wrapper"
          captureDismiss
          isOpen={isReturnSuggestionsOpen}
          onOpened={openReturnSuggestions}
          minimal
          position={PopoverPosition.BOTTOM_LEFT}
          modifiers={{
            flip: { enabled: false },
            preventOverflow: { enabled: false },
          }}
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
              autoFocus
              value={returnNode}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  closeReturnSuggestions();
                  e.stopPropagation();
                } else {
                  onKeyDown(e);
                }
              }}
              onChange={(e) => {
                returnNodeOnChange(e.target.value);
                openReturnSuggestions();
              }}
              placeholder={"Enter Label..."}
            />
          }
        />
        <span
          style={{
            flexGrow: 1,
            display: "inline-block",
            minWidth: 300,
          }}
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
      {selections.map((sel) => (
        <QuerySelection
          key={sel.uid}
          sel={sel}
          selections={selections}
          setSelections={setSelections}
        />
      ))}
      <div style={{ display: "flex" }}>
        <span style={{ minWidth: 144, display: "inline-block" }}>
          <Button
            rightIcon={"plus"}
            text={"Add Condition"}
            style={{ maxHeight: 32 }}
            onClick={() => {
              createBlock({
                parentUid: conditionsNodeUid,
                order: conditions.length,
                node: {
                  text: `${conditions.length}`,
                },
              }).then((uid) =>
                setConditions([
                  ...conditions,
                  { uid, source: "", relation: "", target: "" },
                ])
              );
            }}
          />
        </span>
        <span style={{ display: "inline-block", minWidth: 144 }}>
          <Button
            rightIcon={"plus"}
            text={"Add Selection"}
            style={{ maxHeight: 32 }}
            onClick={() => {
              createBlock({
                parentUid: selectionsNodeUid,
                order: selections.length,
                node: {
                  text: ``,
                },
              }).then((uid) =>
                setSelections([...selections, { uid, text: "", label: "" }])
              );
            }}
          />
        </span>
        <span
          style={{ display: "inline-block", textAlign: "end", flexGrow: 1 }}
        >
          <Button
            text={"Query"}
            onClick={() => {
              setResults(
                fireQuery({
                  conditions,
                  returnNode,
                  selections,
                })
              );
              setShowResults(true);
            }}
            style={{ maxHeight: 32 }}
            intent={"primary"}
            disabled={
              !conditions.length ||
              !conditions.every((c) => !!c.relation && !!c.target) ||
              !returnNode ||
              selections.some((s) => !s.text)
            }
          />
        </span>
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
                  createBlock({
                    node: {
                      text: savedQueryLabel,
                      children: [
                        {
                          text: "query",
                          children: [
                            { text: `Find ${returnNode} Where` },
                            ...conditions.map((c) => ({
                              text: `${c.source} ${c.relation} ${c.target}`,
                            })),
                            ...selections.map((s) => ({
                              text: `Select ${s.text} AS ${s.label}`,
                            })),
                          ],
                        },
                      ],
                    },
                    parentUid: blockUid,
                  }).then((newSavedUid) =>
                    Promise.all(
                      conditions
                        .map((c) => deleteBlock(c.uid))
                        .concat(selections.map((s) => deleteBlock(s.uid)))
                    )
                      .then(() =>
                        setInputSetting({
                          blockUid: scratchNodeUid,
                          value: "",
                          key: "return",
                        })
                      )
                      .then(() => {
                        setSavedQueries([
                          { uid: newSavedUid, text: savedQueryLabel, results },
                          ...savedQueries,
                        ]);
                        setSavedQueryLabel(
                          // temporary
                          savedQueryLabel
                            .split(" ")
                            .map((s) =>
                              s === "Query" ? s : `${Number(s) + 1}`
                            )
                            .join(" ")
                        );
                        setReturnNode("");
                        setConditions([]);
                        setShowResults(false);
                        setResults([]);
                        setSelections([]);
                      })
                  );
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
                  <li key={r.uid}>
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
                        href={getRoamUrl(r.uid)}
                        onClick={(e) => {
                          if (e.ctrlKey || e.shiftKey) {
                            openBlockInSidebar(r.uid);
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
          fireQuery={fireQuery}
          {...exportRenderProps}
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
