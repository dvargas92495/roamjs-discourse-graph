export type Graph = {
  config: {
    nodes: {
      format: string;
      text: string;
      shortcut: string;
      type: string;
    }[];
    relations: {
      triples: string[][];
      id: string;
      label: string;
      source: string;
      destination: string;
      complement: string;
    }[];
    uid: string;
  };
  edges: {
    pagesByUid: Record<string, string>;
    pageUidByTitle: Record<string, string>;
    blocksPageByUid: Record<string, string>;
    blocksByUid: Record<string, string>;
    headingsByUid: Record<string, number>;
    childrenByUid: Record<string, string[]>;
    parentByUid: Record<string, string>;
    ancestorsByUid: Record<string, string[]>;
    descendantsByUid: Record<string, string[]>;
    referencesByUid: Record<string, string[]>;
    linkedReferencesByUid: Record<string, string[]>;
    createUserByUid: Record<string, string>;
    editUserByUid: Record<string, string>;
    createTimeByUid: Record<string, number>;
    editTimeByUid: Record<string, number>;
    userDisplayByUid: Record<string, string>;
    userUidByDisplay: Record<string, string>;
  };
  latest: number;
  updater: number;
};
