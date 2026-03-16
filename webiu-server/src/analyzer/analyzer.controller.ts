import { Controller, Get } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';

@Controller('api/analyzer')
export class AnalyzerController {
  constructor(private readonly analyzerService: AnalyzerService) {}

  @Get('analyze')
  async analyze() {
    return this.analyzerService.analyzeAllRepos();
  }
}