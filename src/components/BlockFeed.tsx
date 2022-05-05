import { InputGroup } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Filter from "roamjs-components/components/Filter";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import ResizableDrawer from "../ResizableDrawer";
import InfiniteLoader from "react-window-infinite-loader";
import { FixedSizeList } from "react-window";
import isAfter from "date-fns/isAfter";
import subWeeks from "date-fns/subWeeks";
import { PullBlock } from "roamjs-components/types";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";

const MIN_DATE = new Date(
  window.roamAlphaAPI.data.fast.q(
    `[:find (min ?t) :where [?q :edit/time ?t]]`
  )[0][0] as number
);

const idRef: Record<string, string> = {};

const getOtherUserIdentifier = (uid: string) =>
  idRef[uid] || (idRef[uid] = getDisplayNameByUid(uid)) || (idRef[uid] = uid);

const BlockFeedContent = () => {
  const [date, setDate] = useState(new Date());
  const hasNextPage = useMemo(() => isAfter(date, MIN_DATE), [date]);
  const [blocks, setBlocks] = useState<
    { uid: string; time: number; text: string; user: string }[]
  >([]);
  const isItemLoaded = useCallback(
    (idx: number) => !hasNextPage || idx < blocks.length,
    [hasNextPage, blocks]
  );
  const itemCount = useMemo(
    () => (hasNextPage ? blocks.length + 1 : blocks.length),
    [hasNextPage, blocks]
  );
  const loadMoreItems = useCallback(() => {
    const newDate = subWeeks(date, 1);
    const newBlocks = window.roamAlphaAPI.data.fast.q(
      `[:find (pull ?q [:block/uid :edit/time :block/string]) (pull ?u [:user/uid]) :where [?q :edit/time ?t] [(> ${date.valueOf()} ?t)] [(<= ${newDate.valueOf()} ?t)] [?q :edit/user ?u]]`
    ) as [PullBlock, PullBlock][];
    setDate(newDate);
    setBlocks(
      blocks.concat(
        newBlocks
          .map((a) => ({
            uid: a[0][":block/uid"],
            time: a[0][":edit/time"],
            text: a[0][":block/string"],
            user: a[1][":user/uid"],
          }))
          .sort((a, b) => b.time - a.time)
      )
    );
  }, [setBlocks, blocks, date]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(700);
  useEffect(() => {
    if (loaderRef.current) {
      setHeight(loaderRef.current.offsetHeight);
    }
  }, [setHeight, loaderRef]);
  return (
    <div
      style={{
        margin: -8,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid",
          borderBottomColor: "#88888880",
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "start",
          minHeight: "min-content",
        }}
      >
        <style>{`.roamjs-block-feed-search {
              flex-grow: 1;
          }`}</style>
        <InputGroup
          leftIcon={"search"}
          placeholder={"Search"}
          style={{ flexGrow: 1 }}
          className={"roamjs-block-feed-search"}
        />
        <Filter data={{}} onChange={() => {}} />
      </div>
      <div style={{ flexGrow: 1 }} ref={loaderRef}>
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <FixedSizeList
              itemCount={itemCount}
              onItemsRendered={onItemsRendered}
              ref={ref}
              height={height}
              width={"100%"}
              itemSize={itemCount}
            >
              {({ style, index }) => {
                const { uid, time, text = '', user } = blocks[index] || {};
                return (
                  <div style={{ ...style, padding: 16 }}>
                    {isItemLoaded(index) ? (
                      <div
                        key={uid}
                        style={{
                          borderTop: "1px solid #88888880",
                          padding: "0 4px",
                          position: "relative",
                        }}
                      >
                        <p style={{ marginTop: 2, fontSize: 12 }}>
                          <b>{getOtherUserIdentifier(user)}</b> edited block{" "}
                          <a href={getRoamUrl(uid)}>(({uid}))</a> at{" "}
                          <i>{new Date(time).toLocaleString()}</i> to:
                        </p>
                        <p style={{ marginTop: 4, fontSize: 10 }}>
                          {text.slice(0, 50)}
                          {text.length > 50 ? "..." : ""}
                        </p>
                      </div>
                    ) : (
                      "Loading..."
                    )}
                  </div>
                );
              }}
            </FixedSizeList>
          )}
        </InfiniteLoader>
      </div>
    </div>
  );
};

const BlockFeed = ({ onClose }: { onClose: () => void }) => {
  return (
    <ResizableDrawer onClose={onClose} title={"Block Feed"}>
      <BlockFeedContent />
    </ResizableDrawer>
  );
};

export const render = createOverlayRender("block-feed", BlockFeed);
