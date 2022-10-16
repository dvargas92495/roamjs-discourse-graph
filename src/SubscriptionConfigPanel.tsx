import { Button, Label } from "@blueprintjs/core";
import React, { useMemo, useRef, useState } from "react";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import BlockInput from "roamjs-components/components/BlockInput";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import PageInput from "roamjs-components/components/PageInput";
import { getUserIdentifier } from "./util";
import type { CustomField } from "roamjs-components/components/ConfigPanels/types";

const SUBSCRIPTION_TYPES = ["page", "block"] as const;

const SubscriptionConfigPanel: CustomField["options"]["component"] = ({
  uid,
  parentUid,
}) => {
  const rootUid = useMemo(() => {
    if (uid) return uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text: getUserIdentifier(), uid: newUid },
      parentUid,
    });
    return newUid;
  }, [parentUid]);
  const [nodes, setNodes] = useState(
    uid
      ? () =>
          getBasicTreeByParentUid(uid).map((n) => ({
            uid: n.uid,
            type: n.text,
            value: n.children?.[0]?.text,
          }))
      : []
  );
  const [activeType, setActiveType] = useState<
    typeof SUBSCRIPTION_TYPES[number]
  >(SUBSCRIPTION_TYPES[0]);
  const [activeValue, setActiveValue] = useState("");
  const activeUid = useRef("");
  const debounceRef = useRef(0);
  return (
    <>
      <div style={{ display: "flex", marginBottom: 8 }}>
        <p>
          This tab is deprecated - we recommend creating custom queries in for
          notification dashboards instead.
        </p>
        <Label>
          Type
          <MenuItemSelect
            activeItem={activeType}
            onItemSelect={(e) => {
              setActiveValue("");
              setActiveType(e);
            }}
            items={[...SUBSCRIPTION_TYPES]}
          />
        </Label>
        <Label style={{ flexGrow: 1, margin: "0 4px" }}>
          Value
          {activeType === "page" && (
            <PageInput
              value={activeValue}
              setValue={(v) => {
                setActiveValue(v);
                window.clearTimeout(debounceRef.current);
                debounceRef.current = window.setTimeout(() => {
                  activeUid.current = getPageUidByPageTitle(v);
                }, 1000);
              }}
            />
          )}
          {activeType === "block" && (
            <BlockInput
              value={activeValue}
              setValue={(v, u) => {
                setActiveValue(v);
                activeUid.current = u;
              }}
            />
          )}
        </Label>
        <Button
          icon={"plus"}
          minimal
          disabled={!activeValue}
          style={{ height: 30, alignSelf: "center" }}
          onClick={() => {
            createBlock({
              parentUid: rootUid,
              order: nodes.length,
              node: {
                text: activeType,
                children: [
                  { text: activeUid.current },
                  { text: new Date().valueOf().toString() },
                ],
              },
            }).then((valueUid) =>
              setNodes([
                ...nodes,
                { type: activeType, value: activeUid.current, uid: valueUid },
              ])
            );
          }}
        />
      </div>
      <ul
        style={{
          listStyle: "none",
          paddingInlineStart: 0,
        }}
      >
        {nodes.map((n) => {
          return (
            <li
              key={n.uid}
              style={{
                border: "1px dashed #80808080",
                padding: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ display: "inline-block", minWidth: 100 }}>
                <b>Type: </b> {n.type}
              </span>
              <span style={{ display: "inline-block", flexGrow: 1 }}>
                <b>Value: </b> <a href={getRoamUrl(n.value)}>{n.value}</a>
              </span>
              <Button
                icon={"trash"}
                onClick={() => {
                  setNodes(nodes.filter((nn) => nn.uid !== n.uid));
                  deleteBlock(n.uid);
                }}
                style={{ minWidth: 30 }}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default SubscriptionConfigPanel;
