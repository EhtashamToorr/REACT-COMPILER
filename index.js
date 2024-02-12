import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import { spawn } from "child_process";

const app = express();
const port = process.env.PORT || 3003;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello, Express!");
});

app.post("/checkQuestion", async (req, res) => {
  const { question, test } = req.body;

  // console.log(req.body);

  const requestId = crypto.randomBytes(16).toString("hex");
  const tempDir = `./temp/${requestId}`;

  // Create a temporary directory for the request
  fs.mkdirSync(tempDir);

  // Write the question to a file within the temporary directory
  const questionFilePath = `${tempDir}/App.jsx`;
  const testPath = `${tempDir}/App.test.js`;
  fs.writeFileSync(questionFilePath, question);
  const importStatement = "import '@testing-library/jest-dom';\n";
  const testContent = importStatement + test;
  fs.writeFileSync(testPath, testContent);

  // return res.status(200).json({ message: "All tests passed!" });

  async function runTests() {
    const npmTestProcess = spawn("npm.cmd", ["test", "--", testPath], {
      cwd: tempDir,
    });

    let testOutput = "";

    npmTestProcess.stdout.on("data", (data) => {
      // Collecting verbose output for reference
      testOutput += data.toString();
    });

    npmTestProcess.stderr.on("data", (data) => {
      // Collecting error output for reference
      testOutput += data.toString();
    });

    npmTestProcess.on("error", (err) => {
      console.error(`Error executing npm test: ${err}`);
      res.status(400).json({ message: "Invalid test", error: err.message });
    });

    npmTestProcess.on("close", (code) => {
      console.log("this is output", testOutput);
      // Analyze testOutput for detailed pass/fail information
      const testSummary = extractTestResults(testOutput);
      // console.log("test results", testSummary);
      // Cleanup the temporary directory
      fs.rm(tempDir, { recursive: true }, (err) => {
        if (err) {
          console.error("Error cleaning up temporary directory:", err);
        } else {
          console.log("Temporary directory deleted successfully");
        }
      });

      if (
        testSummary &&
        testSummary.passed.length > 0 &&
        testSummary.failed.length <= 0
      ) {
        res.status(200).json({ message: "All tests passed!", testSummary });
      } else {
        res.status(200).json({ message: "Some tests failed.", testSummary });
      }
    });
  }

  try {
    await runTests();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

function extractTestResults(output) {
  // Extract test names and status from the output based on the provided patterns
  const testPattern = /(×|√)\s+(.+?)\s+\((\d+ ms)\)/g;

  const testResults = [];
  let match;

  // Extract test names and status
  while ((match = testPattern.exec(output)) !== null) {
    const [, status, testName, duration] = match;
    testResults.push({
      testName,
      status: status === "√" ? "pass" : "fail",
      // duration,
    });
  }

  return {
    testResults,
    passed: testResults
      .filter((result) => result.status === "pass")
      .map((result) => result.testName),
    failed: testResults
      .filter((result) => result.status === "fail")
      .map((result) => result.testName),
  };
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
