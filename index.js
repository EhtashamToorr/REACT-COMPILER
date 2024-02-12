import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import { runCLI } from "@jest/core";
import { spawn } from "child_process";

const app = express();
const port = process.env.PORT || 3003;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello, Express!");
});

app.post("/sendQuestion", async (req, res) => {
  const { question, test } = req.body;

  const requestId = crypto.randomBytes(16).toString("hex");
  const tempDir = `./temp/${requestId}`;

  // Create a temporary directory for the request
  fs.mkdirSync(tempDir);

  // Write the question to a file within the temporary directory
  const questionFilePath = `${tempDir}/App.jsx`;
  const testPath = `${tempDir}/App.test.js`;
  fs.writeFileSync(questionFilePath, question);
  fs.writeFileSync(testPath, test);

  try {
    const npmTestProcess = spawn("npm.cmd", ["test", "--", testPath], {
      cwd: tempDir,
    });

    let testOutput = "";

    npmTestProcess.stdout.on("data", (data) => {
      testOutput += data.toString();
    });

    npmTestProcess.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    npmTestProcess.on("error", (err) => {
      console.error(`Error executing npm test: ${err}`);
    });

    npmTestProcess.on("close", (code) => {
      // console.log(`npm test process exited with code ${code}`);
      console.log("testOutput.....", testOutput);
      // Analyze testOutput for detailed pass/fail information
      const testSummary = extractDetailedTestSummary(testOutput);

      console.log("testSummary", testSummary);

      if (testSummary && testSummary.passed) {
        res.status(200).json({ message: "All tests passed!", testSummary });
      } else {
        res.status(400).json({ message: "Some tests failed.", testSummary });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    // Optionally clean up the temporary directory
    // fs.rm(tempDir, { recursive: true }, () => console.log("done"));
  }
});

function extractDetailedTestSummary(output) {
  const suitesRegex =
    /Test Suites: (.+?)\nTests: (\d+?)\s+?(\d+?)\s+?(\d+?)\s+?(\d+?)\s+?(\d+?)\s+?(\d+?)\s+?(\d+?)\s+?(\d+?)\n/;
  const matchSuites = output.match(suitesRegex);
  console.log("match Suites", matchSuites);

  if (!matchSuites) {
    return null;
  }

  const [
    ,
    testSuites,
    totalTests,
    passed,
    failed,
    skipped,
    pending,
    todo,
    duration,
  ] = matchSuites;

  // Extract information for each test suite and test case
  const testCasesRegex =
    /Test Suite (.+?)\n\s+?(\d+?)\s+?(pass|fail|skip|pending|todo)\s+?(\d+?)\s+?(\d+?)\s+?(\d+?)\n/g;
  let matchCases;
  const testCases = [];

  while ((matchCases = testCasesRegex.exec(output)) !== null) {
    const [, suiteName, total, status, passedCount, failedCount, duration] =
      matchCases;
    const cases = [];

    // Extract information for each test case
    const testCaseRegex = new RegExp(
      `(?:${suiteName} )?([\\w\\s]+?) (pass|fail|skip|pending|todo) (\\d+?)\\s+?(\\d+?)\\s+?(\\d+?)\\n`,
      "g"
    );
    let matchTestCase;

    while ((matchTestCase = testCaseRegex.exec(output)) !== null) {
      const [, testName, caseStatus, duration, errorCount, failureCount] =
        matchTestCase;
      const errors = [];

      // Extract error messages for each failed test case
      if (caseStatus === "fail") {
        const errorRegex = new RegExp(
          `${suiteName} ${testName}\\n(?:.+?\\n)+?((?:.|\n)+?)\\n(?:.|\n)+?(\\d+?)\\)`,
          "g"
        );
        let matchError;

        while ((matchError = errorRegex.exec(output)) !== null) {
          const [, errorMessage, stackTrace] = matchError;
          errors.push({ message: errorMessage, stackTrace });
        }
      }

      cases.push({
        testName,
        status: caseStatus,
        duration,
        errorCount,
        failureCount,
        errors,
      });
    }

    testCases.push({
      suiteName,
      total,
      status,
      passedCount,
      failedCount,
      duration,
      cases,
    });
  }

  return {
    testSuites,
    totalTests,
    passed,
    failed,
    skipped,
    pending,
    todo,
    duration,
    testCases,
    passed: testCases.every((suite) => suite.status === "pass"),
  };
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
