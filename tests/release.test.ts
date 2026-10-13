import assert from "node:assert/strict";
import { test } from "node:test";
import { pickInstaller, repoFromGitUrl } from "../server/release-utils";

test("picks the installer, not the blockmap", () => {
  const assets = [{ name: "NEXUS-Setup-0.1.0.exe.blockmap" }, { name: "latest.yml" }, { name: "NEXUS-Setup-0.1.0.exe" }];
  assert.equal(pickInstaller(assets)?.name, "NEXUS-Setup-0.1.0.exe");
  assert.equal(pickInstaller([{ name: "notes.txt" }]), null);
});

test("reads owner/repo from clone URLs", () => {
  assert.equal(repoFromGitUrl("https://github.com/demonek/nexus.git"), "demonek/nexus");
  assert.equal(repoFromGitUrl("https://github.com/demonek/nexus"), "demonek/nexus");
  assert.equal(repoFromGitUrl("git@github.com:demonek/nexus.git"), "demonek/nexus");
  assert.equal(repoFromGitUrl("https://gitlab.com/a/b"), null);
});
