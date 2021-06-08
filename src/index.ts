import { toConfig } from "roam-client";
import { createConfigObserver } from "roamjs-components";

const CONFIG = toConfig("discourse-graph");
createConfigObserver({ title: CONFIG, config: { tabs: [] } });
