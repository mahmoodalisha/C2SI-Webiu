## The analyzer leverages existing GitHubService APIs to fetch repository data including:
* Commits
* Contributors
* Pull Requests
* Issues
* Languages and repository size
* Stars and forks

After fetching the raw data, all filtering and scoring logic is applied in the AnalyzerService.

# Activity Score
We want to measure:
- Actual code contributions
- Active discussion and maintenance via issues
- Participation from multiple contributors.

How Pull Requests are Considered: Not all pull requests indicate meaningful activity.
Points Considered in activity	and Why:-
- Open PRs are not considered. As	work is ongoing, not yet integrated
- Closed but unmerged PRs	are also not considered ad	work was rejected or abandoned
- ✅ Only merged PRs are considered Work was reviewed, accepted, and merged - represents true contribution

✅ Conclusion: Only merged pull requests are counted for activity.

How Issues are Considered:
Issues represent discussions, bug reports, or tasks. They are indicators of project activity and maintenance, so we include:
- All real issues (open + closed)
- Excluding any issues that are actually pull requests (GitHub treats PRs as issues)

## Normalization and Scoring

Raw counts can vary dramatically between repositories, so we normalize values to a 0–1 scale based on reasonable maximum thresholds:

```
| Metric       | Max Threshold | Weight in Score |
| ------------ | ------------- | --------------- |
| Commits      | 500           | 40%             |
| Contributors | 20            | 30%             |
| Merged PRs   | 100           | 20%             |
| Issues       | 100           | 10%             |
```

The normalized score is then scaled to 0–10

This ensures:
* Small projects aren’t unfairly penalized
* Large projects don’t dominate the scale
* Scores are comparable across different repos

# Complexity Scores
For Complexity Estiimation, We use two indicators:
* Repository size (in KB)
* Number of programming languages used

## Normalizing and scoring
```
| Metric         | Max Threshold | Weight in Score |
| -------------- | ------------- | --------------- |
| Repo size      | 5000 KB       | 70%             |
| Language count | 10            | 30%             |
```

Scaled to 0–10:
```
complexityScore = (0.7 * normSize + 0.3 * normLanguageCount) * 10
```
This ensures that large, multi-language repositories are classified as more complex, while small single-language repos are simpler.

# Learning Difficulty Classification
Based on Activity Score and Complexity Score:
```
| Score Range                     | Classification |
| ------------------------------- | -------------- |
| activity ≥ 7 AND complexity ≥ 7 | Advanced       |
| activity ≥ 4 OR complexity ≥ 4  | Intermediate   |
| else                            | Beginner       |
```

## Design Considerations
1. Separation of concerns:
  * GithubService handles raw data fetching
  * AnalyzerService handles filtering, scoring, and intelligence
2. Filtering logic:
  * Only merged PRs counted
  * Only real issues counted (PRs excluded)
3. Normalization:
  * Ensures scores are 0–10, comparable across repositories of different sizes
4. Edge Cases:
  * Missing or empty data handled gracefully
  * Batch processing with small delays to prevent API rate limiting