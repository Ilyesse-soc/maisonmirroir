import "server-only";
import { database } from "./newsletterDb";
import { makeAuth } from "./authConfiguration";
let instance: ReturnType<typeof makeAuth> | undefined;
export function getAuth() {
  return (instance ||= makeAuth(database()));
}
