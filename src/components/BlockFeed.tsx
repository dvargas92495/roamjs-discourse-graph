import { Icon, InputGroup } from "@blueprintjs/core";
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
import { VariableSizeList } from "react-window";
import isAfter from "date-fns/isAfter";
import subWeeks from "date-fns/subWeeks";
import { PullBlock } from "roamjs-components/types";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import differenceInSeconds from "date-fns/differenceInSeconds";
import differenceInMinutes from "date-fns/differenceInMinutes";
import differenceInHours from "date-fns/differenceInHours";
import differenceInDays from "date-fns/differenceInDays";
import differenceInMonths from "date-fns/differenceInMonths";
import differenceInYears from "date-fns/differenceInYears";

const MIN_DATE = new Date(
  window.roamAlphaAPI.data.fast.q(
    `[:find (min ?t) :where [?q :edit/time ?t]]`
  )[0][0] as number
);

const BlockFeedContent = () => {
  const [date, setDate] = useState(new Date());
  const hasNextPage = useMemo(() => isAfter(date, MIN_DATE), [date]);
  const [blocks, setBlocks] = useState<{ uid: string; time: number }[]>([]);
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
      `[:find (pull ?q [:block/uid :edit/time]) :where [?q :edit/time ?t] [(> ${date.valueOf()} ?t)] [(<= ${newDate.valueOf()} ?t)]]`
    ) as [PullBlock, PullBlock][];
    setDate(newDate);
    setBlocks(
      blocks.concat(
        newBlocks
          .map((a) => ({
            uid: a[0][":block/uid"],
            time: a[0][":edit/time"],
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
  const ItemRenderer = useCallback(
    ({ style, index }: { style: React.CSSProperties; index: number }) => {
      const { uid, time } = blocks[index] || {};
      const timeData = useMemo(() => {
        const now = new Date();
        const then = new Date(time);
        return {
          secondsAgo: differenceInSeconds(now, then),
          minutesAgo: differenceInMinutes(now, then),
          hoursAgo: differenceInHours(now, then),
          daysAgo: differenceInDays(now, then),
          monthsAgo: differenceInMonths(now, then),
          yearsAgo: differenceInYears(now, then),
        };
      }, [time]);
      const blockInfo = useMemo(() => {
        const chain = window.roamAlphaAPI.data.fast
          .q(
            `[:find (pull ?b [:block/string]) (pull ?n [:node/title]) (pull ?p [:block/string :node/title :block/uid]) :where [?b :block/uid "${uid}"] [?b :edit/user ?u] [?u :user/display-page ?n] [?b :block/parents ?p]]`
          )
          .map(([b, u, p]: PullBlock[]) => ({
            text: b[":block/string"],
            user: u[":node/title"],
            parent: {
              text: p[":block/string"] || p[":node/title"],
              uid: p[":block/uid"],
            },
          }));
        if (!chain.length) {
          return (
            window.roamAlphaAPI.data.fast
              .q(
                `[:find (pull ?b [:node/title]) (pull ?n [:node/title]) :where [?b :block/uid "${uid}"] [?b :edit/user ?u] [?u :user/display-page ?n]]`
              )
              .map(([b, u]: PullBlock[]) => ({
                text: b[":node/title"],
                user: u[":node/title"],
                parents: [],
              }))?.[0] || { text: uid, user: uid, parents: [] }
          );
        }
        return {
          text: chain[0].text,
          user: chain[0].user,
          parents: chain.map((p) => p.parent),
        };
      }, [uid]);
      return (
        <div style={{ ...style, borderBottom: "1px solid #88888880" }}
        className={`roamjs-block-feed-item`}>
          {isItemLoaded(index) ? (
            <div
              key={uid}
              style={{
                padding: "16px 0",
                position: "relative",
              }}
            >
              <div className="rm-zoom" style={{ fontSize: 10 }}>
                {blockInfo.parents.map((bc) => (
                  <div
                    key={bc.uid}
                    className="rm-zoom-item"
                    onClick={(e) => {
                      if (!e.shiftKey) {
                        window.roamAlphaAPI.ui.mainWindow.openBlock({
                          block: { uid: bc.uid },
                        });
                      } else {
                        openBlockInSidebar(bc.uid);
                      }
                    }}
                  >
                    <span className="rm-zoom-item-content">{bc.text}</span>
                    <Icon icon={"chevron-right"} />
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 2, fontSize: 16 }}>
                <b>{blockInfo.user}</b> edited{" "}
                {blockInfo.parents.length ? "block" : "page"}{" "}
                <span
                  style={{ cursor: "pointer", color: "#106BA3" }}
                  onClick={(e) => {
                    if (!e.shiftKey) {
                      window.roamAlphaAPI.ui.mainWindow.openBlock({
                        block: { uid },
                      });
                    } else {
                      openBlockInSidebar(uid);
                    }
                  }}
                >
                  {blockInfo.parents.length ? `((${uid}))` : blockInfo.text}
                </span>{" "}
                <i style={{ opacity: 0.5 }}>
                  {timeData.yearsAgo > 0
                    ? `${timeData.yearsAgo} years`
                    : timeData.monthsAgo > 0
                    ? `${timeData.monthsAgo} months`
                    : timeData.daysAgo > 0
                    ? `${timeData.daysAgo} days`
                    : timeData.hoursAgo > 0
                    ? `${timeData.hoursAgo} hours`
                    : timeData.minutesAgo > 0
                    ? `${timeData.minutesAgo} minutes`
                    : `${timeData.secondsAgo} seconds`}{" "}
                  ago
                </i>
              </p>
              {blockInfo.parents.length ? (
                <p
                  style={{
                    marginTop: 4,
                    fontSize: 14,
                    whiteSpace: "break-spaces",
                  }}
                >
                  {blockInfo.text.slice(0, 150)}
                  {blockInfo.text.length > 150 ? "..." : ""}
                </p>
              ) : null}
            </div>
          ) : (
            "Loading..."
          )}
        </div>
      );
    },
    [blocks]
  );
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
          }
          .roamjs-block-feed-item:hover {
            background: #dddddd;
          }
          .roamjs-feed-items-container > div::-webkit-scrollbar {
            width: 6px;
          }
          
          /* Handle */
          .roamjs-feed-items-container > div::-webkit-scrollbar-thumb {
            background: #888;
          }
          .roamjs-feed-items-container > div {
            padding: 0 16px;
          }
          .roamjs-feed-items-container > div > div {
            position: relative;
          }`}</style>
        <InputGroup
          leftIcon={"search"}
          placeholder={"Search"}
          style={{ flexGrow: 1 }}
          className={"roamjs-block-feed-search"}
        />
        <Filter data={{}} onChange={() => {}} />
      </div>
      <div
        style={{ flexGrow: 1 }}
        ref={loaderRef}
        className={"roamjs-feed-items-container"}
      >
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <VariableSizeList
              itemCount={itemCount}
              onItemsRendered={onItemsRendered}
              ref={ref}
              height={height}
              width={"100%"}
              itemSize={() => 200}
            >
              {ItemRenderer}
            </VariableSizeList>
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
