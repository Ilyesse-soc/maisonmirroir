import "server-only";
let busy = 0;
export function claimLoginSlot() {
  if (busy >= 2) return null;
  busy++;
  return () => {
    busy--;
  };
}
