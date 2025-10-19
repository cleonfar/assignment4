---
timestamp: 'Thu Oct 16 2025 00:05:53 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_000553.0c1c1b23.md]]'
content_id: 454404ff5ecd748a2fec0155c6d1de6f7731076db8f1a080183d6cf26dc5242f
---

# response:

That's a fantastic concept design for `ReproductionTracking`! Integrating a Gemini LLM into the `aiSummary` action will greatly enhance its value by providing intelligent insights.

Here's what you need to do to get the AI summary up and running using the Gemini LLM:

### 1. Obtain a Gemini API Key

First, you need an API key to access the Gemini model.

1. **Go to Google AI Studio**: Visit <https://aistudio.google.com/app/apikey>.
2. **Create API Key**: Follow the instructions to create a new API key.
3. **Securely Store Key**: **Never hardcode your API key in your source code.** Use environment variables.

   Create a `.env` file in the root of your project (if you don't have one) and add your key:

   ```env
   GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY_HERE
   ```

   Ensure your `.env` file is in your `.gitignore` to prevent it from being committed to version control.

### 2. Install the Google Generative AI Client Library

For Deno, you can directly import the npm package:

```typescript
// Add this to your ReproductionTrackingConcept.ts (or a utility file)
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
```

### 3. Update the `aiSummary` Action in `ReproductionTrackingConcept.ts`

Now, let's modify the `aiSummary` method to use the Gemini API.

```typescript
// file: src/ReproductionTracking/ReproductionTrackingConcept.ts
import { Collection, Db } from "npm:mongodb";
import { GoogleGenerativeAI } from "npm:@google/generative-ai"; // <--- Add this import
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// ... (existing Sex enum and interfaces: Mother, Offspring, GeneratedReport) ...

export default class ReproductionTrackingConcept {
  // ... (existing constructor and other actions) ...

  /**
   * **action** `aiSummary (report: Report): (summary: String)`
   *
   * **requires** report exists
   * **effects** The AI generates a summary of the report, highlighting key
   *            takeaways and trends shown in the report.
   */
  async aiSummary({ reportName }: { reportName: string }): Promise<{ summary?: string; error?: string }> {
    const report = await this.generatedReports.findOne({ reportName });
    if (!report) {
      return { error: `Report with name '${reportName}' not found.` };
    }

    // Retrieve API Key from environment variable
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return { error: "GEMINI_API_KEY environment variable is not set." };
    }

    try {
      // Initialize the Google Generative AI client
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // Or "gemini-1.5-flash" for faster responses

      // Craft the prompt using the report data
      const prompt = `You are an expert animal husbandry analyst.
Please provide a concise and insightful summary of the following animal reproduction report.
Highlight key takeaways, trends, and actionable insights that can inform breeding decisions.
Focus on reproductive performance, survivability, and any significant patterns.

Reproduction Report Details:
Report Name: "${report.reportName}"
Date Generated: ${report.dateGenerated.toLocaleDateString()}
Target Mothers Count: ${report.results.motherCount}
Report Period: ${report.results.reportPeriod}

Metrics:
- Total Offspring Born: ${report.results.totalOffspringBorn}
- Unique Birth Events: ${report.results.uniqueBirthEvents}
- Average Litter Size: ${report.results.averageLitterSize}
- Total Weaned Offspring: ${report.results.totalWeanedOffspring}
- Survivability Rate to Weaning: ${report.results.survivabilityRateToWeaning}
- Total Deceased Offspring (Post-Birth, Pre-Weaning): ${report.results.totalDeceasedOffspring}

Based on this data, provide a professional summary:`;

      // Make the API call to Gemini
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      return { summary: summary.trim() };
    } catch (e) {
      console.error("Error generating AI summary:", e);
      return { error: `Failed to generate AI summary: ${e.message || "An unknown error occurred."}` };
    }
  }
}
```

### Explanation of Changes:

1. **`import { GoogleGenerativeAI } from "npm:@google/generative-ai";`**: This line imports the necessary library. Deno's `npm:` specifier allows you to directly use npm packages.
2. **API Key Retrieval**: `Deno.env.get("GEMINI_API_KEY")` is used to fetch your API key from the environment variables. A check is added to ensure the key is present.
3. **`new GoogleGenerativeAI(apiKey);`**: Initializes the client with your API key.
4. **`genAI.getGenerativeModel({ model: "gemini-pro" });`**: Specifies which Gemini model to use. `gemini-pro` is a good general-purpose model. You might also consider `gemini-1.5-flash` for potentially faster, slightly cheaper responses, or other models depending on future availability and needs.
5. **`prompt` Construction**:
   * This is crucial for good results. The prompt sets the context ("You are an expert animal husbandry analyst"), defines the task, specifies the desired output format, and provides all the relevant data from the `report.results` in a structured, readable way for the LLM.
6. **`await model.generateContent(prompt);`**: This is the actual call to the Gemini API.
7. **`const summary = response.text();`**: Extracts the generated text content from Gemini's response. `.trim()` is added for cleanliness.
8. **Error Handling**: A `try-catch` block is added to gracefully handle potential network issues, invalid API keys, or other errors that might occur during the API call, returning an `error` message to the caller.

### To Run Your Deno Application with Environment Variables:

When you run your Deno application, you'll need to grant permissions and provide the environment variables.

1. **Install `deno_dotenv` (Optional but recommended for `.env` files)**:
   While Deno's `Deno.env.get` works if you export environment variables, using a `.env` file typically requires a loader. A simple way is to load it at the entry point of your application:

   ```typescript
   // e.g., in your main.ts or entrypoint.ts
   import "https://deno.land/x/dotenv@v3.2.2/load.ts";
   // Now Deno.env.get will pick up variables from your .env file
   ```

   If you choose not to use `deno_dotenv`, you'll need to manually export the `GEMINI_API_KEY` before running your Deno command: `export GEMINI_API_KEY=YOUR_KEY && deno run ...`

2. **Run with Permissions**: When running your Deno application, you'll need to grant network access (for the Gemini API and MongoDB) and environment variable access:

   ```bash
   deno run --allow-net --allow-env --allow-read --allow-write --allow-hrtime <your-main-file>.ts
   ```

   * `--allow-net`: Allows network requests (for Gemini API and MongoDB).
   * `--allow-env`: Allows access to environment variables (for `GEMINI_API_KEY`).
   * `--allow-read`, `--allow-write`: Might be needed for database files or other persistent storage.
   * `--allow-hrtime`: Can sometimes be needed by internal libraries for high-resolution timing.

By following these steps, your `ReproductionTrackingConcept` will be able to leverage Google's Gemini LLM to generate intelligent summaries of your reproductive performance reports!
