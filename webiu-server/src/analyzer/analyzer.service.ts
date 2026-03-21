import { Injectable, Logger } from '@nestjs/common';
import { GithubService, GithubRepo } from '../github/github.service';
import { CacheService } from '../common/cache.service';

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly cacheService: CacheService,
  ) {}

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Normalize value between 0 and 1
   */
  private normalize(value: number, max: number): number {
    if (!value || value <= 0) return 0;
    return Math.min(value / max, 1);
  }

  /**
   * Activity Score (0–10)
   */
  private calculateActivityScore(
    commits: number,
    contributors: number,
    mergedPRs: number,
    issues: number,
  ): number {
    const normCommits = this.normalize(commits, 500);
    const normContributors = this.normalize(contributors, 20);
    const normPRs = this.normalize(mergedPRs, 100);
    const normIssues = this.normalize(issues, 100);

    const score =
      normCommits * 0.4 +
      normContributors * 0.3 +
      normPRs * 0.2 +
      normIssues * 0.1;

    return Number((score * 10).toFixed(2));
  }

  /**
   * Complexity Score (0–10)
   */
  private calculateComplexityScore(
    repoSize: number,
    languageCount: number,
  ): number {
    const normSize = this.normalize(repoSize, 5000);
    const normLangs = this.normalize(languageCount, 10);

    const score = normSize * 0.7 + normLangs * 0.3;

    return Number((score * 10).toFixed(2));
  }

  /**
   * Difficulty Classification
   */
  private classifyDifficulty(
    activityScore: number,
    complexityScore: number,
  ): 'Beginner' | 'Intermediate' | 'Advanced' {
    if (activityScore >= 7 && complexityScore >= 7) {
      return 'Advanced';
    } else if (activityScore >= 4 || complexityScore >= 4) {
      return 'Intermediate';
    } else {
      return 'Beginner';
    }
  }

  async analyzeAllRepos() {
    const cacheKey = 'analyzer:all_repos';
    const cached = this.cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const results = [];
    const repos: GithubRepo[] = await this.githubService.getAllOrgReposSorted();

    const BATCH_SIZE = 5;

    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
      const batch = repos.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          try {
            const repoName = repo.name;
            const org = this.githubService.org;

            const [commitActivity, contributors, pulls, issues, languages] =
              await Promise.all([
                this.githubService.getCommitActivity(repoName),
                this.githubService.getRepoContributors(org, repoName),
                this.githubService.getRepoPulls(repoName),
                this.githubService.getRepoIssues(org, repoName),
                this.githubService.getRepoLanguages(repoName),
              ]);

            // 🔹 COMMITS
            const totalCommits =
              commitActivity?.reduce(
                (sum, week) => sum + (week.total || 0),
                0,
              ) || 0;

            // CONTRIBUTORS
            const contributorCount = contributors?.length || 0;

            // PR LOGIC
            const mergedPRs = pulls?.filter((pr) => pr.merged_at).length || 0;

            //ISSUE LOGIC
            const realIssues =
              issues?.filter((issue) => !issue.pull_request).length || 0;

            //COMPLEXITY INPUTS
            const languageCount = Object.keys(languages || {}).length;
            const repoSize = Number(repo.size ?? 0);

            //SCORES
            const activityScore = this.calculateActivityScore(
              totalCommits,
              contributorCount,
              mergedPRs,
              realIssues,
            );

            const complexityScore = this.calculateComplexityScore(
              repoSize,
              languageCount,
            );

            const learningDifficulty = this.classifyDifficulty(
              activityScore,
              complexityScore,
            );

            return {
              repo: repo.name,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              contributors: contributorCount,
              commits: totalCommits,
              mergedPRs,
              issues: realIssues,
              languages,
              activityScore,
              complexityScore,
              learningDifficulty,
            };
          } catch (err) {
            this.logger.error(`Failed to analyze ${repo.name}: ${err.message}`);
            return null;
          }
        }),
      );

      results.push(
        ...batchResults
          .filter((r) => r.status === 'fulfilled' && r.value)
          .map((r: any) => r.value),
      );

      await this.sleep(1000);
    }

    this.cacheService.set(cacheKey, results, 3600);
    return results;
  }
}
