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
  openBlockInSidebar,
  RoamBasicNode,
} from "roam-client";
import {
  createOverlayRender,
  getSettingValueFromTree,
  MenuItemSelect,
  PageInput,
  setInputSetting,
  toFlexRegex,
  useArrowKeyDown,
} from "roamjs-components";
import ResizableDrawer from "./ResizableDrawer";
import { englishToDatalog, getNodes, getRelations } from "./util";

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
        <InputGroup
          value={con.target}
          onChange={(e) => {
            window.clearTimeout(debounceRef.current);
            setConditions(
              conditions.map((c) =>
                c.uid === con.uid ? { ...con, target: e.target.value } : c
              )
            );
            debounceRef.current = window.setTimeout(() => {
              setInputSetting({
                blockUid: con.uid,
                value: e.target.value,
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

const QueryDrawerContent = ({ clearOnClick, blockUid }: Props) => {
  const tree = useMemo(() => getBasicTreeByParentUid(blockUid), []);
  const discourseNodes = useMemo(getNodes, []);
  const nodeFormatByLabel = useMemo(
    () => Object.fromEntries(discourseNodes.map((n) => [n.text, n.format])),
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
  const pinnedNode = useMemo(
    () => scratchNodeChildren.find((t) => toFlexRegex("pinned").test(t.text)),
    [scratchNodeChildren]
  );
  const [pinnedNodeUid, setPinnedNodeUid] = useState(pinnedNode?.uid);
  const pinnedNodeChildren = useMemo(
    () => pinnedNode?.children || [],
    [pinnedNode]
  );
  const debounceRef = useRef(0);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<RoamBasicNode["children"]>([]);
  const [clearedResults, setClearedResults] = useState(
    () => new Set(pinnedNodeChildren.map((t) => t.text))
  );
  const filteredResults = useMemo(
    () => results.filter((r) => !clearedResults.has(r.uid)),
    [results, clearedResults]
  );
  const translator = useMemo(englishToDatalog, []);
  const fireQuery = useCallback(() => {
    try {
      const results = window.roamAlphaAPI
        .q(
          `[:find (pull ?${returnNode} [[:block/string :as "text"] [:node/title :as "text"] :block/uid]) :where ${conditions
            .map((c) => translator[c.relation](c.source, c.target))
            .join(" ")}]`
        )
        .map((a) => a[0] as RoamBasicNode);
      setResults(results);
    } catch (e) {
      console.error("Error from Roam:");
      console.error(e.message);
      setResults([]);
    }
    setShowResults(true);
  }, [setShowResults, setResults, conditions, returnNode, nodeFormatByLabel]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeIndex, onKeyDown } = useArrowKeyDown({
    onEnter: (value) => {
      if (isReturnSuggestionsOpen) {
        setReturnNode(value.text);
        closeReturnSuggestions();
      }
    },
    results: returnSuggestions,
  });
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
                window.clearTimeout(debounceRef.current);
                setReturnNode(e.target.value);
                setIsReturnSuggestionsOpen(true);
                debounceRef.current = window.setTimeout(() => {
                  setInputSetting({
                    blockUid: scratchNodeUid,
                    value: e.target.value,
                    key: "return",
                  });
                }, 1000);
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
            setClearedResults(new Set());
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
                      results: filteredResults.map(({ text, uid }) => ({
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
                  if (pinnedNodeUid) {
                    deleteBlock(pinnedNodeUid);
                    setPinnedNodeUid("");
                    setClearedResults(new Set());
                  } else {
                    setPinnedNodeUid(
                      createBlock({
                        node: { text: "pinned" },
                        parentUid: scratchNodeUid,
                        order: 2,
                      })
                    );
                  }
                }}
                minimal
                active={!!pinnedNodeUid}
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
          {filteredResults.length ? (
            <>
              <i style={{ opacity: 0.8 }}>
                Found {filteredResults.length} results
              </i>
              <ul>
                {filteredResults.map((r) => (
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
                      {pinnedNodeUid && (
                        <Button
                          icon={"hand-right"}
                          minimal
                          onClick={() => {
                            createBlock({
                              parentUid: pinnedNodeUid,
                              node: { text: r.uid },
                              order: clearedResults.size,
                            });
                            setClearedResults(
                              new Set([...clearedResults, r.uid])
                            );
                            clearOnClick?.(r.text, returnNode);
                          }}
                        />
                      )}
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
