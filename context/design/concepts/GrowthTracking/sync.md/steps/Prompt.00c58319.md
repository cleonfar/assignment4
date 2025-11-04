---
timestamp: 'Sun Nov 02 2025 19:21:57 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251102_192157.74adff65.md]]'
content_id: 00c5831937e12aafbc63a8f5776acc2b26d369fc977ae6aa781796308cf57d9c
---

# Prompt: Here is the AI call implementation from another concept, I think it should mostly work similar here, could you work it into this concept?

/\*\*

* Private helper to encapsulate LLM interaction logic.
* Handles prompt construction, API call, and response parsing/validation.
* @param {Report} report - The report object to be summarized.
* @returns {Promise<string>} The stringified, validated JSON summary.
* @throws {Error} If GEMINI\_API\_KEY is not set, or if LLM response is invalid.
  \*/
  private async \_callLLMAndGetSummary(report: Report): Promise<string> {
  const apiKey = Deno.env.get("GEMINI\_API\_KEY");
  if (!apiKey) {
  throw new Error("GEMINI\_API\_KEY not set in environment variables.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

```
const fullPrompt =
```

```
  `You are an expert livestock analyst. Given the following report, respond ONLY with valid JSON in this exact format:
```

{
"highPerformers": \[],
"lowPerformers": \[],
"concerningTrends": \[],
"averagePerformers": \[],
"potentialRecordErrors": \[],
"insights": "A few short paragraphs (2-3) with deeper analysis: summarize the most important findings, discuss possible causes for low performance or concerning trends, and suggest practical management or intervention strategies for these cases. Do not focus on average/moderate performers, but do mention if the overall average performance of the group stands out as particularly good or bad."
}
Do not include any explanation, commentary, or text before or after the JSON. Only output valid JSON. If you cannot determine a category, return an empty array for that field. Only include animals/mothers in 'averagePerformers' if they are not in any other category. Every animal in the report must be classified into at least one of the following categories: highPerformers, lowPerformers, concerningTrends, averagePerformers, or potentialRecordErrors. No animal should be left unclassified.

Be highly suspicious of questionable or inconsistent records. Be liberal about classifying something as a potential record error: if there is any reasonable doubt or anything seems odd, include the animal or mother in 'potentialRecordErrors' and mention the issue in 'insights'. Do not hesitate to flag records that seem unusual or inconsistent.

Here are some examples of suspicious or potentially erroneous records:

* A mother having more weaned than birthed
* Weaning records without a corresponding birth record
* Negative or impossible values (e.g., negative weights, negative gains, or negative counts)
* Impossibly high or low numbers for the species or age (e.g., a lamb weighing 500kg, or a newborn with an adult weight)
* Obvious typos (such as an extra zero, misplaced decimal, or swapped digits)
* Duplicate or missing records
* Any other data that seems inconsistent, out of range, or highly unlikely
  Mark records as a potential record error if they may include a typo or if the values are impossibly good or bad for the species or age. Err on the side of caution and flag anything that could possibly be a record error.

Absolutely ensure that every animal or mother you think might have a record error is included in the 'potentialRecordErrors' array—no exceptions. If you mention or suspect a record error for an animal or mother in your analysis, their ID must appear in 'potentialRecordErrors'.

Here is the report data:
Report Name: ${report.\_id}
Generated Date: ${report.dateGenerated.toISOString()}
Target Mothers: ${report.target.join(", ")}
Report Entries:
${report.results.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}
\`;

````
const result = await model.generateContent(fullPrompt);
let text = result.response.text(); // Get raw text

// Pre-processing for LLM output: remove markdown code block delimiters
text = text.trim();
if (text.startsWith("```json")) {
  text = text.substring("```json".length).trimStart();
}
if (text.endsWith("```")) {
  text = text.substring(0, text.length - "```".length).trimEnd();
}

let parsedResponse: LLMSummaryOutput;
try {
  parsedResponse = JSON.parse(text);
  // Basic validation of the parsed structure and types
  if (
    !Array.isArray(parsedResponse.highPerformers) ||
    !parsedResponse.highPerformers.every((item) =>
      typeof item === "string"
    ) ||
    !Array.isArray(parsedResponse.lowPerformers) ||
    !parsedResponse.lowPerformers.every((item) =>
      typeof item === "string"
    ) ||
    !Array.isArray(parsedResponse.concerningTrends) ||
    !parsedResponse.concerningTrends.every((item) =>
      typeof item === "string"
    ) ||
    !Array.isArray(parsedResponse.averagePerformers) ||
    !parsedResponse.averagePerformers.every((item) =>
      typeof item === "string"
    ) ||
    !Array.isArray(parsedResponse.potentialRecordErrors) ||
    !parsedResponse.potentialRecordErrors.every((item) =>
      typeof item === "string"
    ) ||
    typeof parsedResponse.insights !== "string"
  ) {
    throw new Error(
      "Parsed JSON does not match expected structure or types.",
    );
  }
} catch (parseError) {
  console.error(
    "LLM response was not valid JSON or did not match structure:",
    text,
    parseError,
  );
  throw new Error(`Invalid JSON response from LLM. Raw response: ${text}`);
}

return text; // Return the stringified, validated JSON
````

}

/\*\*

* **query** `_aiSummary (reportName: String): (summary: String)`
*
* **requires** report exists
* **effects** The AI generates a summary of the report, highlighting key takeaways
* and trends shown in the report, and saves it for future viewing.
* If a summary already exists, it is returned without calling the AI.
* @param {object} args - The query arguments.
* @param {string} args.reportName - The name of the report to summarize.
* @returns {{ summary?: string; error?: string }} The AI-generated summary (as a stringified JSON), or an error.
  \*/
  async \_aiSummary({
  reportName,
  }: {
  reportName: string;
  }): Promise<{ summary?: string; error?: string }> {
  const report = await this.reports.findOne({
  \_id: reportName as ReportName,
  });
  if (!report) {
  return { error: `Report with name '${reportName}' not found.` };
  }

```
// New: If a summary already exists, return it immediately to avoid redundant AI calls.
```

```
if (report.summary !== "") {
  return { summary: report.summary };
}

// Otherwise, generate a new summary
try {
  const generatedSummary = await this._callLLMAndGetSummary(report);

  // Save the generated summary back to the report
  await this.reports.updateOne(
    { _id: reportName as ReportName },
    { $set: { summary: generatedSummary } },
  );

  return { summary: generatedSummary };
} catch (llmError: any) {
  console.error("Error generating AI summary:", llmError);
  return {
    error: `Failed to generate AI summary: ${
      llmError.message || "Unknown LLM error"
    }`,
  };
}
```

}

/\*\*

* **action** `regenerateAISummary (reportName: String): (summary: String)`
*
* **requires** report exists
* **effects** Forces the AI to generate a new summary of the report,
* overwriting any existing summary, and saves it for future viewing.
* @param {object} args - The action arguments.
* @param {string} args.reportName - The name of the report to re-summarize.
* @returns {{ summary?: string; error?: string }} The newly AI-generated summary (as a stringified JSON), or an error.
  \*/
  async regenerateAISummary({
  reportName,
  }: {
  reportName: string;
  }): Promise<{ summary?: string; error?: string }> {
  const report = await this.reports.findOne({
  \_id: reportName as ReportName,
  });
  if (!report) {
  return { error: `Report with name '${reportName}' not found.` };
  }

```
// Always generate a new summary, overwriting any existing one
```

```
try {
  const generatedSummary = await this._callLLMAndGetSummary(report);

  // Save the generated summary back to the report
  await this.reports.updateOne(
    { _id: reportName as ReportName },
    { $set: { summary: generatedSummary } },
  );

  return { summary: generatedSummary };
} catch (llmError: any) {
  console.error("Error regenerating AI summary:", llmError);
  return {
    error: `Failed to regenerate AI summary: ${
      llmError.message || "Unknown LLM error"
    }`,
  };
}
```

}
}
