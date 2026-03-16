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

  async analyzeAllRepos() {
    const cacheKey = 'analyzer:all_repos';
    const cached = this.cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const results = [];
    const repos: GithubRepo[] = await this.githubService.getAllOrgReposSorted();

    const BATCH_SIZE = 5; // Number of repos to process in parallel

    for (let i = 0; i < repos.length; i += BATCH_SIZE) {
      const batch = repos.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (repo) => {
          try {
            const repoName = repo.name;
            const org = this.githubService.org;

            // Fetch all metrics concurrently per repo
            const [commitActivity, contributors, pulls, issues, languages] =
              await Promise.all([
                this.githubService.getCommitActivity(repoName),
                this.githubService.getRepoContributors(org, repoName),
                this.githubService.getRepoPulls(repoName),
                this.githubService.getRepoIssues(org, repoName),
                this.githubService.getRepoLanguages(repoName),
              ]);

            const totalCommits =
              commitActivity?.reduce(
                (sum, week) => sum + (week.total || 0),
                0,
              ) || 0;
            const contributorCount = contributors?.length || 0;
            const prCount = pulls?.length || 0;
            const issueCount = issues?.length || 0;

            const activityScore =
              totalCommits * 0.5 +
              contributorCount * 2 +
              prCount * 1.5 +
              issueCount * 1;

            const languageCount = Object.keys(languages || {}).length;
            const repoSize = Number(repo.size ?? 0);
            const complexityScore = repoSize * 0.3 + languageCount * 10;

            let learningDifficulty: 'Beginner' | 'Intermediate' | 'Advanced';
            if (activityScore > 500 && complexityScore > 500) {
              learningDifficulty = 'Advanced';
            } else if (activityScore > 200 || complexityScore > 200) {
              learningDifficulty = 'Intermediate';
            } else {
              learningDifficulty = 'Beginner';
            }

            return {
              repo: repo.name,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              contributors: contributorCount,
              commits: totalCommits,
              pullRequests: prCount,
              issues: issueCount,
              languages,
              activityScore,
              complexityScore,
              learningDifficulty,
            };
          } catch (err) {
            this.logger.error(`Failed to analyze ${repo.name}: ${err.message}`);
            return null; // skip failed repo
          }
        }),
      );

      results.push(
        ...batchResults.filter((r) => r.status === 'fulfilled' && r.value),
      );
      await this.sleep(1000); // small delay between batches to avoid rate limit
    }

    // Cache full analysis for 1 hour
    this.cacheService.set(cacheKey, results, 3600);
    return results;
  }
}
