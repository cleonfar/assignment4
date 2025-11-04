/**
 * The Requesting concept exposes passthrough routes by default,
 * which allow POSTs to the route:
 *
 * /{REQUESTING_BASE_URL}/{Concept name}/{action or query}
 *
 * to passthrough directly to the concept action or query.
 * This is a convenient and natural way to expose concepts to
 * the world, but should only be done intentionally for public
 * actions and queries.
 *
 * This file allows you to explicitly set inclusions and exclusions
 * for passthrough routes:
 * - inclusions: those that you can justify their inclusion
 * - exclusions: those to exclude, using Requesting routes instead
 */

/**
 * INCLUSIONS
 *
 * Each inclusion must include a justification for why you think
 * the passthrough is appropriate (e.g. public query).
 *
 * inclusions = {"route": "justification"}
 */

export const inclusions: Record<string, string> = {
  // Feel free to delete these example inclusions
  "/api/LikertSurvey/_getSurveyQuestions": "this is a public query",
  "/api/LikertSurvey/_getSurveyResponses": "responses are public",
  "/api/LikertSurvey/_getRespondentAnswers": "answers are visible",
  "/api/LikertSurvey/submitResponse": "allow anyone to submit response",
  "/api/LikertSurvey/updateResponse": "allow anyone to update their response",
};

/**
 * EXCLUSIONS
 *
 * Excluded routes fall back to the Requesting concept, and will
 * instead trigger the normal Requesting.request action. As this
 * is the intended behavior, no justification is necessary.
 *
 * exclusions = ["route"]
 */

export const exclusions: Array<string> = [
  // Feel free to delete these example exclusions
  "/api/LikertSurvey/createSurvey",
  "/api/LikertSurvey/addQuestion",
  "/api/AnimalIdentity/registerAnimal",
  "/api/AnimalIdentity/updateStatus",
  "/api/AnimalIdentity/editDetails",
  "/api/AnimalIdentity/markAsDeceased",
  "/api/AnimalIdentity/markAsTransferred",
  "/api/AnimalIdentity/markAsSold",
  "/api/AnimalIdentity/removeAnimal",
  "/api/AnimalIdentity/_getAnimal",
  "/api/AnimalIdentity/_getAllAnimals",
  "/api/GrowthTracking/_toDate",
  "/api/GrowthTracking/recordWeight",
  "/api/GrowthTracking/removeWeightRecord",
  "/api/GrowthTracking/generateReport",
  "/api/GrowthTracking/renameReport",
  "/api/GrowthTracking/deleteReport",
  "/api/GrowthTracking/_callLLMAndGetSummary",
  "/api/GrowthTracking/aiSummary",
  "/api/GrowthTracking/_getAiSummary",
  "/api/GrowthTracking/_getAnimalWeights",
  "/api/GrowthTracking/_getReportByName",
  "/api/GrowthTracking/_listReports",
  "/api/GrowthTracking/_getAllAnimalsWithWeightRecords",
  "/api/GrowthTracking/deleteAnimal",
  "/api/HerdGrouping/createHerd",
  "/api/HerdGrouping/addAnimal",
  "/api/HerdGrouping/removeAnimal",
  "/api/HerdGrouping/moveAnimal",
  "/api/HerdGrouping/mergeHerds",
  "/api/HerdGrouping/splitHerd",
  "/api/HerdGrouping/deleteHerd",
  "/api/HerdGrouping/restoreHerd",
  "/api/HerdGrouping/_viewComposition",
  "/api/HerdGrouping/_listActiveHerds",
  "/api/HerdGrouping/_listArchivedHerds",
  "/api/ReproductionTracking/_toDate",
  "/api/ReproductionTracking/addMother",
  "/api/ReproductionTracking/removeMother",
  "/api/ReproductionTracking/recordLitter",
  "/api/ReproductionTracking/updateLitter",
  "/api/ReproductionTracking/recordOffspring",
  "/api/ReproductionTracking/updateOffspring",
  "/api/ReproductionTracking/recordWeaning",
  "/api/ReproductionTracking/recordDeath",
  "/api/ReproductionTracking/generateReport",
  "/api/ReproductionTracking/renameReport",
  "/api/ReproductionTracking/_viewReport",
  "/api/ReproductionTracking/deleteReport",
  "/api/ReproductionTracking/_callLLMAndGetSummary",
  "/api/ReproductionTracking/_aiSummary",
  "/api/ReproductionTracking/regenerateAISummary",
  "/api/ReproductionTracking/_listMothers",
  "/api/ReproductionTracking/_listLittersByMother",
  "/api/ReproductionTracking/_listOffspringByLitter",
  "/api/ReproductionTracking/_listReports",
  "/api/UserAuthentication/register",
  "/api/UserAuthentication/login",
  "/api/UserAuthentication/verify",
  "/api/UserAuthentication/logout",
];
