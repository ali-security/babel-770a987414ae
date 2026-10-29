"use strict";

// Jest reporter that names every skipped test and the reason it is skipped,
// so CI logs carry more than jest's bare "N skipped" count.
// Plain ES2015 on purpose: it runs untranspiled on the Node 6 leg too.

const path = require("path");

const STATIC_SKIPS = {
  "packages/babel-traverse/test/traverse.js":
    "upstream it.skip: requeue after skip is unsupported (see the comment in NodePath.requeue)",
  "eslint/babel-eslint-tests/test/integration/eslint/eslint.js":
    "upstream it.skip: no-unused-vars support for object rest/spread was removed (babel-eslint #249)",
};

function reasonFor(relPath, test) {
  const lastSegment = test.title.split("/").pop();
  if (lastSegment.charAt(0) === ".") {
    return (
      "fixture directory '" +
      lastSegment +
      "' is dot-prefixed, which @babel/helper-fixtures marks as disabled (upstream-disabled fixture)"
    );
  }
  if (relPath === "packages/babel-core/test/async.js") {
    return "nodeGte8 helper skips it on Node 6 (" + process.version + "): async functions need Node >= 8";
  }
  if (relPath === "packages/babel-standalone/test/babel.js") {
    return "@babel/standalone smoke tests are describe.skip'd when TEST_TYPE=cov (the coverage build does not build the standalone bundle)";
  }
  if (STATIC_SKIPS[relPath]) return STATIC_SKIPS[relPath];
  return "UNKNOWN skip reason";
}

class SealSkippedTestsReporter {
  constructor(globalConfig) {
    this._rootDir = globalConfig.rootDir;
  }

  onRunComplete(contexts, results) {
    const lines = [];
    const suites = [];
    const byReason = {};
    results.testResults.forEach(file => {
      const relPath = path
        .relative(this._rootDir, file.testFilePath)
        .split(path.sep)
        .join("/");
      let fileReason = null;
      file.testResults.forEach(test => {
        if (test.status !== "pending" && test.status !== "skipped") return;
        const reason = reasonFor(relPath, test);
        fileReason = reason;
        const category = reason.replace(/^fixture directory '[^']*'/, "fixture directory");
        byReason[category] = (byReason[category] || 0) + 1;
        lines.push(
          "  SKIPPED " + relPath + " > " + test.fullName + " -- reason: " + reason
        );
      });
      if (file.skipped) {
        suites.push(
          "  SKIPPED SUITE " + relPath + " -- reason: " + (fileReason || "UNKNOWN skip reason")
        );
      }
    });
    // Summary last, so it stays near the end of the log after the long list.
    console.log("\nSkipped tests (" + lines.length + "):");
    lines.forEach(line => console.log(line));
    console.log("\nSkipped test suites (" + suites.length + "):");
    suites.forEach(line => console.log(line));
    console.log("\nSkipped tests by reason (" + lines.length + " total):");
    Object.keys(byReason).forEach(reason => {
      console.log("  " + byReason[reason] + " x " + reason);
    });
  }
}

module.exports = SealSkippedTestsReporter;
