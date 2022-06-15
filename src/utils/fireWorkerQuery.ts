import { listeners, getDataWorker } from "../dataWorkerClient";
import nanoid from "nanoid";
import { DatalogClause } from "roamjs-components/types";

export type FireQuery = typeof window.roamjs.extension.queryBuilder.fireQuery;

const fireWorkerQuery = ({
  where,
  pull,
}: {
  where: DatalogClause[];
  pull: {
    label: string;
    field: string;
    _var: string;
  }[];
}) =>
  getDataWorker().then(
    (worker) =>
      new Promise<ReturnType<FireQuery>>((resolve) => {
        const id = nanoid();
        const listenerKey = `fireQuery_${id}`;
        listeners[listenerKey] = (response) => {
          delete listeners[listenerKey];
          resolve((response as { results: ReturnType<FireQuery> })?.results);
        };
        worker.postMessage({
          method: "fireQuery",
          id,
          where,
          pull,
        });
      })
  );

export default fireWorkerQuery;
