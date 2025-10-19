---
timestamp: 'Thu Oct 16 2025 18:44:56 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251016_184456.8d82ec3d.md]]'
content_id: 58cdee37d7a4bb1b4cb013335e25c321fb859e43aeff9f14114e40fae2b5b3ba
---

# Prompt: Let's get the AI summary set up. The prompt to the AI should look something like this

\`You are an expert livestock analyst. Given the following report, respond ONLY with valid JSON in this exact format:
{
"highPerformers": \["animalId1", ...],
"lowPerformers": \["animalId2", ...],
"concerningTrends": \["animalId3", ...],
"averagePerformers": \["animalId4", ...],
"potentialRecordErrors": \["animalId5", ...],
"insights": "A few short paragraphs (2-3) with deeper analysis: summarize the most important findings, discuss possible causes for low performance or concerning trends, and suggest practical management or intervention strategies for these cases. Do not focus on average/moderate performers, but do mention if the overall average performance of the group stands out as particularly good or bad."
}
Do not include any explanation, commentary, or text before or after the JSON. Only output valid JSON. If you cannot determine a category, return an empty array for that field. Only include animals/mothers in 'averagePerformers' if they are not in any other category. Every animal in the report must be classified into at least one of the following categories: highPerformers, lowPerformers, concerningTrends, averagePerformers, or potentialRecordErrors. No animal should be left unclassified.

```
Be highly suspicious of questionable or inconsistent records. Be liberal about classifying something as a potential record error: if there is any reasonable doubt or anything seems odd, include the animal or mother in 'potentialRecordErrors' and mention the issue in 'insights'. Do not hesitate to flag records that seem unusual or inconsistent.

Here are some examples of suspicious or potentially erroneous records:
- A mother having more weaned than birthed
- Weaning records without a corresponding birth record
- Negative or impossible values (e.g., negative weights, negative gains, or negative counts)
- Impossibly high or low numbers for the species or age (e.g., a lamb weighing 500kg, or a newborn with an adult weight)
- Obvious typos (such as an extra zero, misplaced decimal, or swapped digits)
- Duplicate or missing records
- Any other data that seems inconsistent, out of range, or highly unlikely
Mark records as a potential record error if they may include a typo or if the values are impossibly good or bad for the species or age. Err on the side of caution and flag anything that could possibly be a record error.

Absolutely ensure that every animal or mother you think might have a record error is included in the 'potentialRecordErrors' array—no exceptions. If you mention or suspect a record error for an animal or mother in your analysis, their ID must appear in 'potentialRecordErrors'.
```
