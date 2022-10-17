import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";

export const getUserIdentifier = () => {
  const uid = getCurrentUserUid();
  return getCurrentUserDisplayName() || getDisplayNameByUid(uid) || uid;
};
