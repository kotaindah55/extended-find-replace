import { execSync } from "child_process";
import { readFileSync } from "fs";
import { ManifestConfig } from "./version-bump.mjs";

let { version } = JSON.parse(readFileSync("manifest.json", "utf8")) as ManifestConfig;
execSync(`git tag -a ${version} -f -m "${version}" && git push origin ${version}`);