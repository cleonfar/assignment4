---
timestamp: 'Fri Oct 17 2025 08:38:21 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251017_083821.f2bc0cee.md]]'
content_id: f0c6eb17e25929be6abb6e7b5b195d4948061e6d415bf66fa2b409387ec78ee2
---

# response:

To integrate the AI summary generation using the Gemini LLM, I've updated the `_aiSummary` query.

Here's a summary of the changes:

1. **Added LLM Import**: Imported `GoogleGenerativeAI` from `npm:@google/generative-ai`.
2. **Defined `LLMSummaryOutput` Interface**: Created a TypeScript interface to accurately type the expected JSON structure from the LLM, enhancing type safety.
3. **Modified `_aiSummary` Query**:
   * The query now first checks if a summary already exists (`report.summary !== ""`). If it does, it returns the existing summary (which is a stringified JSON).
   * If no summary exists, it constructs a detailed prompt using the report's name, generation date, target mothers, and report entries.
   * It initializes `GoogleGenerativeAI` and uses the `gemini-2.5-flash-lite` model. It includes a check for the `GEMINI_API_KEY` environment variable.
   * It calls the LLM's `generateContent` method with the constructed prompt.
   * The LLM's response text is then parsed as JSON. Robust error handling is included to catch cases where the LLM might return invalid JSON or a structure that doesn't match the expected `LLMSummaryOutput`.
   * The validated, stringified JSON summary is then saved back to the `report.summary` field in the database.
   * The function returns the stringified JSON summary.

This implementation assumes that the `GEMINI_API_KEY` environment variable is correctly set up for Deno to access the Gemini API.
