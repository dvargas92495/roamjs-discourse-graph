import {
  Button,
  Classes,
  Drawer,
  H3,
  H6,
  InputGroup,
  Label,
  Menu,
  MenuItem,
  Popover,
  PopoverPosition,
  Position,
  Switch,
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
  getPageUidByPageTitle,
  getRoamUrl,
  getTextByBlockUid,
  openBlockInSidebar,
  RoamBasicNode,
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

const SavedQuery = ({
  uid,
  clearOnClick,
  onDelete,
}: {
  uid: string;
  clearOnClick: (s: string, t: string) => void;
  onDelete: () => void;
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(uid), []);
  const [minimized, setMinimized] = useState(false);
  const label = useMemo(() => getTextByBlockUid(uid), []);
  const initialResults = useMemo(
    () => getSubTree({ tree, key: "results" }).children,
    []
  );
  const query = useMemo(
    () => getSettingValuesFromTree({ tree, key: "query" }),
    []
  );
  const returnNode = /^Find (.*) Where$/.exec(query[0])?.[1];
  const [results, setResults] = useState(
    initialResults.map((r) => ({
      uid: r.uid,
      title: r.children?.[0]?.text,
      pageUid: r.text,
    }))
  );
  const sortedResults = useMemo(() => results, [results]);
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
        {label}
        <div>
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
        <>
          <div style={{ fontSize: 10 }}>
            {query.map((q, i) => (
              <p key={i} style={{ margin: 0 }}>
                {q}
              </p>
            ))}
          </div>
          {sortedResults.length ? (
            <>
              <i style={{ opacity: 0.8 }}>
                Found {sortedResults.length} results
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
                        {r.title}
                      </a>
                      <Button
                        icon={"hand-right"}
                        minimal
                        onClick={() => {
                          deleteBlock(r.uid);
                          setResults(
                            results.filter((res) => res.uid !== r.uid)
                          );
                          clearOnClick?.(r.title, returnNode);
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
        </>
      )}
    </div>
  );
};

const QueryDrawerContent = ({ clearOnClick, blockUid }: Props) => {
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), []);
  const discourseNodes = useMemo(getNodes, []);
  const nodeFormatByLabel = useMemo(
    () => Object.fromEntries(discourseNodes.map((n) => [n.text, n.format])),
    []
  );
  const nodeLabelByType = useMemo(
    () => Object.fromEntries(discourseNodes.map((n) => [n.type, n.text])),
    []
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
  const [results, setResults] = useState<RoamBasicNode["children"]>([]);
  const translator = useMemo(englishToDatalog, []);
  const fireQuery = useCallback(() => {
    const where = conditions
      .flatMap((c) => {
        const native = translator[c.relation];
        if (native) return native(c.source, c.target);
        const filteredRelations = discourseRelations.filter(
          (r) =>
            (r.label === c.relation &&
              (nodeLabelByType[r.source].startsWith(c.source) ||
                nodeLabelByType[r.destination].startsWith(c.target))) ||
            ((nodeLabelByType[r.destination].startsWith(c.source) ||
              nodeLabelByType[r.source].startsWith(c.target)) &&
              r.complement === c.relation)
        );
        if (!filteredRelations.length) return "";
        return `(or-join [?${c.source}] ${filteredRelations.map(
          ({ triples, source, destination, label, complement }) => {
            const queryTriples = triples.map((t) => t.slice(0));
            const sourceTriple = queryTriples.find((t) => t[2] === "source");
            const destinationTriple = queryTriples.find(
              (t) => t[2] === "destination"
            );
            if (!sourceTriple || !destinationTriple) return "";
            let returnNodeVar = "";
            if (label === c.relation) {
              destinationTriple[1] = "Has Title";
              destinationTriple[2] = c.target;
              sourceTriple[2] = source;
              if (nodeLabelByType[source].startsWith(returnNode)) {
                returnNodeVar = sourceTriple[0];
              }
            } else if (complement === c.relation) {
              sourceTriple[1] = "Has Title";
              sourceTriple[2] = c.target;
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
    const query = `[:find (pull ?${returnNode} [[:block/string :as "text"] [:node/title :as "text"] :block/uid]) :where ${where}]`;
    try {
      const results = where
        ? window.roamAlphaAPI.q(query).map((a) => a[0] as RoamBasicNode)
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
          relationLabels={Array.from(
            new Set(
              Object.keys(translator).concat(
                discourseRelations.flatMap((r) => [r.label, r.complement])
              )
            )
          ).sort()}
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
                icon={"export"}
                minimal
                onClick={() =>
                  exportRender({
                    fromQuery: {
                      results: results.map(({ text, uid }) => ({
                        title: text,
                        uid,
                      })),
                      conditions: conditions.map((c) => ({
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
                icon={"pin"}
                onClick={() => {
                  const newSavedUid = createBlock({
                    node: {
                      text: savedQueryLabel,
                      children: [
                        {
                          text: "results",
                          children: results.map((r) => ({
                            text: r.uid,
                            children: [{ text: r.text }],
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
            />
          ))}
        </>
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
