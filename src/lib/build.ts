// Which commit this build came from, for the revision line in the footer —
// the site's equivalent of a drawing's revision block. In GitHub Actions the
// SHA is in the environment; locally, ask git. Evaluated once per build.
import { execSync } from "node:child_process";

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

export const BUILD_SHA = commit();
export const BUILD_DATE = new Date();
