## Architecture
The analyzer is implemented in the following files:
src/analyzer
 ├── analyzer.module.ts
 ├── analyzer.service.ts
 ├── analyzer.controller.ts
 └── README.md

 ## Reuse of Existing GitHub Services

Instead of implementing new GitHub API logic, the analyzer reuses the existing GitHub service located at: webiu-server\src\github\github.service.ts

This service already provides optimized methods for interacting with the GitHub API such as:
* getAllOrgReposSorted()
* getCommitActivity()
* getRepoContributors()
* getRepoPulls()
* getRepoIssues()
* getRepoLanguages()


## Repository Analysis Logic
Each repository is evaluated using two primary metrics:
- Activity Score
- Complexity Score
These metrics are then used to determine the repository’s Learning Difficulty.

## Activity Score
The activity score measures how actively a repository is being developed.
Formula:
activityScore =
  (totalCommits × 0.5) +
  (contributors × 2) +
  (pullRequests × 1.5) +
  (issues × 1)

Factors Considered:
```
| Metric        | Description                           |
| ------------- | ------------------------------------- |
| Commits       | Indicates development activity        |
| Contributors  | Shows collaboration level             |
| Pull Requests | Reflects contribution workflow        |
| Issues        | Indicates maintenance and discussions |
```

## Complexity Score
The complexity score estimates how complex the codebase might be.
Formula:
complexityScore =
  (repositorySize × 0.3) +
  (languageCount × 10)

Factors Considered:
```
| Metric          | Description                                   |
| --------------- | --------------------------------------------- |
| Repository Size | Total size of repository from GitHub metadata |
| Language Count  | Number of programming languages used          |
```
Repositories with multiple languages and larger codebases are generally more complex to understand.

## Learning Difficulty Classification
Repositories are categorized into three levels.
```
| Difficulty   | Criteria                          |
| ------------ | --------------------------------- |
| Beginner     | Low activity and low complexity   |
| Intermediate | Moderate activity or complexity   |
| Advanced     | Very high activity and complexity |
```
Logic:
```
if (activityScore > 500 && complexityScore > 500)
  Advanced
else if (activityScore > 200 || complexityScore > 200)
  Intermediate
else
  Beginner
```

## Problem faced and how I worked on them: Excessive GitHub API Calls
The initial implementation of the analyzer made multiple GitHub API requests per repository.
For each repository, the analyzer fetched:
- commit activity
- contributors
- pull requests
- issues
- languages
Analyzing so many repositories in the C2SI organization resulted in GitHub API rate limit errors
In the early testing, the analyzer failed to return results due to these issues

## Optimization Strategy

To resolve this problem, several optimizations are implemented.

1. Reusing Cached GitHub API Responses
The existing GithubService already integrates with the project's CacheService.
This ensures that repeated API requests do not repeatedly hit GitHub.

Cached data:
* repository metadata
* commit activity
* language breakdown
* pull request data

Thus Caching reduces redundant API requests.

2. Batched Repository Processing

Instead of processing all repositories simultaneously, repositories are analyzed in batches.
```
const BATCH_SIZE = 5
```
Only five repositories are analyzed concurrently. Benefits: prevents overwhelming GitHub API and reduces network bursts

3. Delay Between Batches

To further protect against rate limits, a delay is introduced between batches.
```
await sleep(1000)
```
This small pause ensures that API requests are spread over time rather than sent all at once.

4. Parallel API Calls per Repository

Within each repository analysis, API calls are executed concurrently using:
```
Promise.all()
```
This allows the analyzer to fetch: commits, contributors, issues, pull requests, languages at the same time for a single repository.

5. Fault Tolerant Processing

The analyzer uses:
```
Promise.allSettled()
```
instead of Promise.all().

This ensures that if one repository fails, the entire analysis does not fail. Failed repositories are logged and skipped.

## Edge Case Handling

Several edge cases are handled to ensure robustness.

### Missing Commit Activity

GitHub statistics endpoints sometimes return incomplete data.
Solution:
```
commitActivity?.reduce(...) || 0
```
This ensures that missing commit data defaults to 0 commits.

### Missing Languages

If GitHub fails to return language data:
```
Object.keys(languages || {}).length
```
The analyzer safely handles empty language objects.

### Repositories With No Activity

Repositories with no commits, pull requests, or issues are handled gracefully by defaulting values to 0.

## API Endpoint

The analyzer exposes the following endpoint:

GET http://localhost:5050/api/analyzer/analyze

## Example Analysis

Output from the analyzer:
```
{
    "status": "fulfilled",
    "value": {
      "repo": "APT",
      "stars": 1,
      "forks": 0,
      "contributors": 0,
      "commits": 0,
      "pullRequests": 0,
      "issues": 2,
      "languages": {},
      "activityScore": 2,
      "complexityScore": 0,
      "learningDifficulty": "Beginner"
    }
  },
  {
    "status": "fulfilled",
    "value": {
      "repo": "b0bot",
      "stars": 36,
      "forks": 69,
      "contributors": 5,
      "commits": 12,
      "pullRequests": 79,
      "issues": 77,
      "languages": {
        "Python": 41787,
        "HTML": 13096,
        "JavaScript": 1395,
        "Shell": 57
      },
      "activityScore": 211.5,
      "complexityScore": 677.5,
      "learningDifficulty": "Intermediate"
    }
  },
  {
    "status": "fulfilled",
    "value": {
      "repo": "Bassa",
      "stars": 1,
      "forks": 0,
      "contributors": 33,
      "commits": 0,
      "pullRequests": 0,
      "issues": 0,
      "languages": {
        "JavaScript": 72259,
        "Python": 53278,
        "HTML": 20394,
        "SCSS": 9889,
        "Shell": 2951,
        "Dockerfile": 1608
      },
      "activityScore": 66,
      "complexityScore": 603.9,
      "learningDifficulty": "Intermediate"
    }
  },
  {
    "status": "fulfilled",
    "value": {
      "repo": "Bassa-mobile",
      "stars": 1,
      "forks": 0,
      "contributors": 14,
      "commits": 0,
      "pullRequests": 0,
      "issues": 0,
      "languages": {
        "JavaScript": 99508,
        "Objective-C": 3894,
        "Java": 1877,
        "Starlark": 1720
      },
      "activityScore": 28,
      "complexityScore": 685.9,
      "learningDifficulty": "Intermediate"
    }
  },
  {
    "status": "fulfilled",
    "value": {
      "repo": "bug-connector",
      "stars": 8,
      "forks": 8,
      "contributors": 3,
      "commits": 0,
      "pullRequests": 8,
      "issues": 4,
      "languages": {
        "Python": 33332
      },
      "activityScore": 22,
      "complexityScore": 2745.7,
      "learningDifficulty": "Intermediate"
    }
  },
  {
    "status": "fulfilled",
    "value": {
      "repo": "c2siorg.github.io",
      "stars": 2,
      "forks": 13,
      "contributors": 5,
      "commits": 19,
      "pullRequests": 14,
      "issues": 10,
      "languages": {
        "HTML": 1266280,
        "SCSS": 285341,
        "JavaScript": 2220,
        "Shell": 1414,
        "Ruby": 112
      },
      "activityScore": 50.5,
      "complexityScore": 4315.7,
      "learningDifficulty": "Intermediate"
    }
  },
  {
    "status": "fulfilled",
    "value": {
      "repo": "ChainKeeper",
      "stars": 1,
      "forks": 1,
      "contributors": 5,
      "commits": 0,
      "pullRequests": 0,
      "issues": 0,
      "languages": {
        "JavaScript": 345647,
        "CSS": 189822,
        "C++": 151214,
        "SCSS": 82676,
        "Less": 78481,
        "Python": 12811,
        "HTML": 4809,
        "CMake": 3907,
        "C": 530
      },
      "activityScore": 10,
      "complexityScore": 1422.3,
      "learningDifficulty": "Intermediate"
    }
  },
  {
    "status": "fulfilled",
    "value": {
      "repo": "CloudActiveWeb",
      "stars": 1,
      "forks": 0,
      "contributors": 1,
      "commits": 0,
      "pullRequests": 2,
      "issues": 0,
      "languages": {
        "Python": 5307,
        "HCL": 4097,
        "Shell": 22
      },
      "activityScore": 5,
      "complexityScore": 34.8,
      "learningDifficulty": "Beginner"
    }
  },
```
