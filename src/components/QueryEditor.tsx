import {
  Button,
  H6,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  PopoverPosition,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RoamBasicNode } from "roamjs-components/types";
import useArrowKeyDown from "roamjs-components/hooks/useArrowKeyDown";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import createBlock from "roamjs-components/writes/createBlock";
import setInputSetting from "roamjs-components/util/setInputSetting";
import { ANY_REGEX } from "../utils/fireQuery";
import parseQuery from "../utils/parseQuery";
import { Condition, Selection } from "../utils/types";
import { englishToDatalog, getNodes, getRelations } from "../util";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import PageInput from "roamjs-components/components/PageInput";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { render as renderSimpleAlert } from "roamjs-components/components/SimpleAlert";

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
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          minWidth: 300,
          alignItems: "center",
        }}
      >
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

const QueryEditor = ({
  parentUid,
  defaultQuery,
  onQuery,
}: {
  parentUid: string;
  defaultQuery: string[];
  onQuery: (query: {
    returnNode: string;
    conditions: Condition[];
    selections: Selection[];
  }) => Promise<void>;
}) => {
  const tree = useMemo(() => getBasicTreeByParentUid(parentUid), [parentUid]);
  const discourseNodes = useMemo(getNodes, []);
  const discourseRelations = useMemo(getRelations, []);
  const translator = useMemo(englishToDatalog, []);

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
  const scratchNode = useMemo(
    () => tree.find((t) => toFlexRegex("scratch").test(t.text)),
    [tree]
  );
  const scratchNodeUid = useMemo(() => {
    if (scratchNode?.uid) return scratchNode?.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text: "scratch", uid: newUid },
      parentUid,
    });
    return newUid;
  }, [scratchNode, parentUid]);
  const scratchNodeChildren = useMemo(
    () => scratchNode?.children || [],
    [scratchNode]
  );
  const [returnNode, setReturnNode] = useState(
    getSettingValueFromTree({
      tree: scratchNodeChildren,
      key: "return",
    })
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
  const debounceRef = useRef(0);
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
  const returnSuggestions = useMemo(
    () =>
      returnNode
        ? discourseNodes.filter(({ text }) => text.startsWith(returnNode))
        : [],
    [discourseNodes, returnNode]
  );
  const { activeIndex, onKeyDown } = useArrowKeyDown({
    onEnter: (value) => {
      if (isReturnSuggestionsOpen) {
        returnNodeOnChange(value.text);
        closeReturnSuggestions();
      }
    },
    results: returnSuggestions,
  });
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
  useEffect(() => {
    const {
      returnNode: value,
      conditionNodes,
      selectionNodes,
    } = parseQuery(defaultQuery);
    Promise.all([
      setInputSetting({
        blockUid: scratchNodeUid,
        value,
        key: "return",
      }),
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
    ]).then(([, conditionNodesWithUids, selections]) => {
      setReturnNode(value);
      setConditions(conditionNodesWithUids);
      setSelections(selections);
    });
  }, [
    defaultQuery,
    relationLabels,
    setReturnNode,
    setConditions,
    conditionsNodeUid,
    selectionsNodeUid,
    setSelections,
    scratchNodeUid,
  ]);
  useEffect(() => {
    if (!window.roamAlphaAPI.data.fast?.q)
      renderSimpleAlert({
        content:
          'This feature depends on using the latest version of Roam.\n\nPlease click "Check for Updates" from the top right menu to update Roam!',
        onConfirm: () => {},
      });
  }, []);
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
              onQuery({
                conditions,
                returnNode,
                selections,
              })
                .then(() =>
                  setInputSetting({
                    blockUid: scratchNodeUid,
                    value: "",
                    key: "return",
                  })
                )
                .then(() => {
                  setReturnNode("");
                  setConditions([]);
                  setSelections([]);
                });
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
    </>
  );
};

export default QueryEditor;
