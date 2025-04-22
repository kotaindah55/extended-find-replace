import { execSync } from "child_process";
import { readFileSync } from "fs";

let { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
execSync(`git tag -a ${version} -m "${version}" && git push origin ${version}`);