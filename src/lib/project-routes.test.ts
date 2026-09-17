import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UNASSIGNED_PROJECT_ID,
  isUnassignedProjectId,
  micrositePublicUrl,
  parseProjectIdFromPath,
  projectInboxPath,
  projectPagePath,
  projectQrNewPath,
  projectQrPath,
  projectQrcodesPath,
  projectSectionPath,
} from "./project-routes";

describe("project routes", () => {
  it("parses project id from dashboard path", () => {
    assert.equal(parseProjectIdFromPath("/dashboard/projects/abc/page"), "abc");
    assert.equal(parseProjectIdFromPath("/dashboard/settings"), null);
  });

  it("builds nested project urls", () => {
    assert.equal(projectPagePath("p1", "tab=review"), "/dashboard/projects/p1/page?tab=review");
    assert.equal(projectQrPath("p1", "qr9"), "/dashboard/projects/p1/qrcodes/qr9");
    assert.equal(projectQrNewPath("p1"), "/dashboard/projects/p1/qrcodes/new");
    assert.equal(projectQrcodesPath(UNASSIGNED_PROJECT_ID), "/dashboard/projects/unassigned/qrcodes");
    assert.equal(projectInboxPath("p1", "submissions"), "/dashboard/projects/p1/inbox?tab=submissions");
    assert.equal(projectSectionPath("p1", "settings"), "/dashboard/projects/p1/settings");
  });

  it("treats unassigned as a reserved project id", () => {
    assert.equal(isUnassignedProjectId(UNASSIGNED_PROJECT_ID), true);
    assert.equal(isUnassignedProjectId("cuid"), false);
  });

  it("builds public microsite url from slug", () => {
    assert.equal(micrositePublicUrl("cafe"), "/a/cafe");
    assert.equal(micrositePublicUrl("  "), null);
  });
});
