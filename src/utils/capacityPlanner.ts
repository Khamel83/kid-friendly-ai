/**
 * Capacity planning utilities for the kid-friendly-ai monitoring system
 * Provides resource usage trend analysis, growth forecasting, scaling recommendations,
 * cost optimization insights, performance bottleneck identification, and automated scaling triggers
 */

import {
  CapacityMetrics,
  CapacityForecast,
  ScalingRecommendation,
  PerformanceMetric,
  ResourceUsage,
  MonitoringEvent
} from '../types/monitoring';
import { monitoringManager } from './monitoringManager';

export interface CapacityPlanningConfig {
  enabled: boolean;
  forecastingEnabled: boolean;
  alertingEnabled: boolean;
  dataRetentionDays: number;
  forecastingHorizonDays: number;
  alertThresholds: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  scalingThresholds: {
    scaleUpCpu: number;
    scaleUpMemory: number;
    scaleDownCpu: number;
    scaleDownMemory: number;
  };
  costOptimization: {
    enabled: boolean;
    targetUtilization: number;
    analysisFrequency: number;
  };
}

export interface CapacityAnalysis {
  timestamp: number;
  metrics: CapacityMetrics;
  trends: {
    cpu: 'increasing' | 'decreasing' | 'stable';
    memory: 'increasing' | 'decreasing' | 'stable';
    disk: 'increasing' | 'decreasing' | 'stable';
    network: 'increasing' | 'decreasing' | 'stable';
  };
  forecasts: CapacityForecast[];
  recommendations: ScalingRecommendation[];
  costOptimization: {
    currentCost: number;
    potentialSavings: number;
    recommendations: string[];
  };
}

export interface GrowthModel {
  type: 'linear' | 'exponential' | 'logarithmic' | 'polynomial';
  parameters: {
    slope?: number;
    intercept?: number;
    growthRate?: number;
    coefficient?: number;
  };
  rSquared: number;
  confidence: number;
}

export interface CapacityPlanningReport {
  generatedAt: number;
  period: {
    start: number;
    end: number;
  };
  summary: {
    currentUtilization: ResourceUsage;
    projectedUtilization: ResourceUsage;
    riskAssessment: 'low' | 'medium' | 'high';
    recommendations: ScalingRecommendation[];
  };
  detailedAnalysis: {
    resourceTrends: Record<string, GrowthModel>;
    bottleneckAnalysis: {
      primaryBottleneck: string;
      secondaryBottlenecks: string[];
      projectedFailureTime?: number;
    };
    costAnalysis: {
      currentCost: number;
      projectedCost: number;
      optimizationOpportunities: string[];
    };
  };
  actionItems: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export class CapacityPlanner {
  private static instance: CapacityPlanner;
  private config: CapacityPlanningConfig;
  private historicalMetrics: Map<string, CapacityMetrics[]> = new Map();
  private forecasts: Map<string, CapacityForecast[]> = new Map();
  private recommendations: Map<string, ScalingRecommendation[]> = new Map();
  private analysisHistory: CapacityAnalysis[] = [];
  private eventListeners: Set<(event: MonitoringEvent) => void> = new Set();
  private analysisInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initialize();
  }

  static getInstance(): CapacityPlanner {
    if (!CapacityPlanner.instance) {
      CapacityPlanner.instance = new CapacityPlanner();
    }
    return CapacityPlanner.instance;
  }

  private getDefaultConfig(): CapacityPlanningConfig {
    return {
      enabled: true,
      forecastingEnabled: true,
      alertingEnabled: true,
      dataRetentionDays: 90,
      forecastingHorizonDays: 30,
      alertThresholds: {
        cpu: 85,
        memory: 90,
        disk: 80,
        network: 75
      },
      scalingThresholds: {
        scaleUpCpu: 80,
        scaleUpMemory: 85,
        scaleDownCpu: 30,
        scaleDownMemory: 40
      },
      costOptimization: {
        enabled: true,
        targetUtilization: 70,
        analysisFrequency: 86400000 // 24 hours
      }
    };
  }

  private initialize(): void {
    this.startPeriodicAnalysis();
    this.loadHistoricalData();
  }

  private startPeriodicAnalysis(): void {
    this.analysisInterval = setInterval(() => {
      this.performCapacityAnalysis();
      this.checkCapacityAlerts();
      this.cleanupOldData();
    }, 3600000); // Every hour
  }

  private loadHistoricalData(): void {
    // Load existing metrics from monitoring manager
    const allMetrics = monitoringManager.getPerformanceMetrics();
    this.processHistoricalMetrics(allMetrics);
  }

  private processHistoricalMetrics(metrics: PerformanceMetric[]): void {
    const groupedMetrics = this.groupMetricsByTimestamp(metrics);

    groupedMetrics.forEach((group, timestamp) => {
      const capacityMetrics: CapacityMetrics = this.convertToCapacityMetrics(group, parseInt(timestamp));
      this.storeCapacityMetrics(capacityMetrics);
    });
  }

  private groupMetricsByTimestamp(metrics: PerformanceMetric[]): Map<string, PerformanceMetric[]> {
    const grouped = new Map<string, PerformanceMetric[]>();

    metrics.forEach(metric => {
      const timestamp = new Date(metric.timestamp).toISOString().split('T')[0]; // Group by day
      if (!grouped.has(timestamp)) {
        grouped.set(timestamp, []);
      }
      grouped.get(timestamp)!.push(metric);
    });

    return grouped;
  }

  private convertToCapacityMetrics(metrics: PerformanceMetric[], timestamp: number): CapacityMetrics {
    const cpuMetrics = metrics.filter(m => m.name.includes('cpu'));
    const memoryMetrics = metrics.filter(m => m.name.includes('memory'));
    const diskMetrics = metrics.filter(m => m.name.includes('disk'));
    const networkMetrics = metrics.filter(m => m.name.includes('network'));

    return {
      timestamp,
      cpu: this.calculateAverageMetric(cpuMetrics),
      memory: this.calculateAverageMetric(memoryMetrics),
      disk: this.calculateAverageMetric(diskMetrics),
      network: this.calculateAverageMetric(networkMetrics),
      requests: this.calculateSumMetric(metrics.filter(m => m.name.includes('requests'))),
      responseTime: this.calculateAverageMetric(metrics.filter(m => m.name.includes('response_time'))),
      users: this.calculateMaxMetric(metrics.filter(m => m.name.includes('users'))),
      cost: this.calculateEstimatedCost(metrics)
    };
  }

  private calculateAverageMetric(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  private calculateSumMetric(metrics: PerformanceMetric[]): number {
    return metrics.reduce((sum, metric) => sum + metric.value, 0);
  }

  private calculateMaxMetric(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return Math.max(...metrics.map(m => m.value));
  }

  private calculateEstimatedCost(metrics: PerformanceMetric[]): number {
    // Simple cost estimation based on resource usage
    const cpuUsage = this.calculateAverageMetric(metrics.filter(m => m.name.includes('cpu')));
    const memoryUsage = this.calculateAverageMetric(metrics.filter(m => m.name.includes('memory')));

    // Base cost estimation (simplified)
    return (cpuUsage * 0.1 + memoryUsage * 0.05) / 100;
  }

  private storeCapacityMetrics(metrics: CapacityMetrics): void {
    const key = new Date(metrics.timestamp).toISOString().split('T')[0];

    if (!this.historicalMetrics.has(key)) {
      this.historicalMetrics.set(key, []);
    }

    const dayMetrics = this.historicalMetrics.get(key)!;
    dayMetrics.push(metrics);

    // Keep only last 90 days of data
    const cutoff = Date.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);
    this.historicalMetrics.forEach((metrics, key) => {
      if (new Date(key).getTime() < cutoff) {
        this.historicalMetrics.delete(key);
      }
    });
  }

  // Capacity Analysis
  public performCapacityAnalysis(): CapacityAnalysis {
    const currentMetrics = this.getCurrentCapacityMetrics();
    const trends = this.analyzeTrends();
    const forecasts = this.generateForecasts();
    const recommendations = this.generateScalingRecommendations(currentMetrics, forecasts);
    const costOptimization = this.analyzeCostOptimization();

    const analysis: CapacityAnalysis = {
      timestamp: Date.now(),
      metrics: currentMetrics,
      trends,
      forecasts,
      recommendations,
      costOptimization
    };

    this.analysisHistory.push(analysis);

    // Keep only last 30 days of analysis
    if (this.analysisHistory.length > 30) {
      this.analysisHistory = this.analysisHistory.slice(-30);
    }

    this.emitEvent({
      id: `capacity_analysis_${Date.now()}`,
      type: 'custom',
      source: 'capacity_planner',
      timestamp: Date.now(),
      data: { action: 'capacity_analysis', analysis },
      tags: {}
    });

    return analysis;
  }

  private getCurrentCapacityMetrics(): CapacityMetrics {
    // Get current system metrics
    const metrics = monitoringManager.getPerformanceMetrics();
    return this.convertToCapacityMetrics(metrics, Date.now());
  }

  private analyzeTrends(): {
    cpu: 'increasing' | 'decreasing' | 'stable';
    memory: 'increasing' | 'decreasing' | 'stable';
    disk: 'increasing' | 'decreasing' | 'stable';
    network: 'increasing' | 'decreasing' | 'stable';
  } {
    const recentData = this.getRecentMetrics(7); // Last 7 days

    const analyzeResourceTrend = (resource: keyof CapacityMetrics): 'increasing' | 'decreasing' | 'stable' => {
      if (recentData.length < 2) return 'stable';

      const values = recentData.map(d => d[resource] as number).filter(v => v > 0);
      if (values.length < 2) return 'stable';

      // Simple linear regression to determine trend
      const n = values.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = values.reduce((sum, val) => sum + val, 0);
      const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
      const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

      if (Math.abs(slope) < 0.1) return 'stable';
      return slope > 0 ? 'increasing' : 'decreasing';
    };

    return {
      cpu: analyzeResourceTrend('cpu'),
      memory: analyzeResourceTrend('memory'),
      disk: analyzeResourceTrend('disk'),
      network: analyzeResourceTrend('network')
    };
  }

  private getRecentMetrics(days: number): CapacityMetrics[] {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentMetrics: CapacityMetrics[] = [];

    this.historicalMetrics.forEach(metrics => {
      metrics.forEach(metric => {
        if (metric.timestamp >= cutoff) {
          recentMetrics.push(metric);
        }
      });
    });

    return recentMetrics.sort((a, b) => a.timestamp - b.timestamp);
  }

  private generateForecasts(): CapacityForecast[] {
    if (!this.config.forecastingEnabled) return [];

    const forecasts: CapacityForecast[] = [];
    const resources: (keyof CapacityMetrics)[] = ['cpu', 'memory', 'disk', 'network'];

    resources.forEach(resource => {
      const forecast = this.generateResourceForecast(resource);
      if (forecast) {
        forecasts.push(forecast);
      }
    });

    this.forecasts.set(Date.now().toString(), forecasts);
    return forecasts;
  }

  private generateResourceForecast(resource: keyof CapacityMetrics): CapacityForecast | null {
    const historicalData = this.getRecentMetrics(30); // Last 30 days
    if (historicalData.length < 7) return null;

    const values = historicalData.map(d => d[resource] as number).filter(v => v > 0);
    if (values.length < 7) return null;

    // Try different models and pick the best fit
    const models = [
      this.fitLinearModel(values),
      this.fitExponentialModel(values),
      this.fitPolynomialModel(values, 2)
    ];

    const bestModel = models.reduce((best, current) =>
      current.rSquared > best.rSquared ? current : best
    );

    if (bestModel.rSquared < 0.3) return null; // Poor fit

    // Forecast future values
    const forecastDays = this.config.forecastingHorizonDays;
    const currentValue = values[values.length - 1];
    let forecastedValue = currentValue;

    switch (bestModel.type) {
      case 'linear':
        forecastedValue = bestModel.parameters.slope! * forecastDays + bestModel.parameters.intercept!;
        break;
      case 'exponential':
        forecastedValue = currentValue * Math.pow(1 + bestModel.parameters.growthRate!, forecastDays);
        break;
      case 'polynomial':
        // Simplified polynomial projection
        forecastedValue = currentValue + bestModel.parameters.slope! * forecastDays;
        break;
    }

    const risk = this.assessForecastRisk(currentValue, forecastedValue, resource);
    const recommendations = this.generateForecastRecommendations(currentValue, forecastedValue, resource);

    return {
      metric: resource,
      currentValue,
      forecastedValue,
      timeframe: `${forecastDays} days`,
      confidence: bestModel.confidence,
      recommendations,
      risk,
      actionRequired: risk === 'high'
    };
  }

  private fitLinearModel(values: number[]): GrowthModel {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumYY = values.reduce((sum, val) => sum + (val * val), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const meanY = sumY / n;
    const totalSumSquares = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const residualSumSquares = values.reduce((sum, y, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);

    const rSquared = totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);

    return {
      type: 'linear',
      parameters: { slope, intercept },
      rSquared,
      confidence: Math.min(0.95, rSquared + 0.3)
    };
  }

  private fitExponentialModel(values: number[]): GrowthModel {
    // Transform to linear by taking log
    const logValues = values.map(v => Math.log(v));
    const linearModel = this.fitLinearModel(logValues);

    return {
      type: 'exponential',
      parameters: {
        slope: Math.exp(linearModel.parameters.intercept!),
        growthRate: linearModel.parameters.slope
      },
      rSquared: linearModel.rSquared,
      confidence: linearModel.confidence * 0.9
    };
  }

  private fitPolynomialModel(values: number[], degree: number): GrowthModel {
    // Simplified polynomial fitting (using linear approximation)
    const linearModel = this.fitLinearModel(values);

    return {
      type: 'polynomial',
      parameters: {
        slope: linearModel.parameters.slope,
        intercept: linearModel.parameters.intercept,
        coefficient: 0
      },
      rSquared: linearModel.rSquared * 1.1, // Slightly better fit assumption
      confidence: Math.min(0.9, linearModel.confidence + 0.1)
    };
  }

  private assessForecastRisk(currentValue: number, forecastedValue: number, resource: keyof CapacityMetrics): 'low' | 'medium' | 'high' {
    const threshold = this.config.alertThresholds[resource];
    const growthPercentage = ((forecastedValue - currentValue) / currentValue) * 100;

    if (forecastedValue > threshold) {
      return 'high';
    }

    if (growthPercentage > 50) {
      return 'high';
    }

    if (growthPercentage > 20) {
      return 'medium';
    }

    return 'low';
  }

  private generateForecastRecommendations(currentValue: number, forecastedValue: number, resource: keyof CapacityMetrics): string[] {
    const recommendations: string[] = [];
    const threshold = this.config.alertThresholds[resource];
    const growthPercentage = ((forecastedValue - currentValue) / currentValue) * 100;

    if (forecastedValue > threshold) {
      recommendations.push(`Immediate scaling required for ${resource} - projected to exceed ${threshold}%`);
    }

    if (growthPercentage > 30) {
      recommendations.push(`Monitor ${resource} growth closely - ${growthPercentage.toFixed(1)}% increase projected`);
    }

    if (growthPercentage > 10) {
      recommendations.push(`Consider optimizing ${resource} usage patterns`);
    }

    return recommendations;
  }

  private generateScalingRecommendations(currentMetrics: CapacityMetrics, forecasts: CapacityForecast[]): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];

    // Check scale-up conditions
    if (currentMetrics.cpu > this.config.scalingThresholds.scaleUpCpu) {
      recommendations.push({
        type: 'horizontal',
        resource: 'cpu',
        currentValue: currentMetrics.cpu,
        recommendedValue: Math.max(currentMetrics.cpu * 1.5, 50),
        reason: 'CPU usage exceeds scale-up threshold',
        priority: 'high',
        estimatedImpact: {
          performance: 40,
          cost: 25
        },
        timeframe: 'immediate'
      });
    }

    if (currentMetrics.memory > this.config.scalingThresholds.scaleUpMemory) {
      recommendations.push({
        type: 'vertical',
        resource: 'memory',
        currentValue: currentMetrics.memory,
        recommendedValue: Math.max(currentMetrics.memory * 1.3, 60),
        reason: 'Memory usage exceeds scale-up threshold',
        priority: 'high',
        estimatedImpact: {
          performance: 35,
          cost: 30
        },
        timeframe: 'immediate'
      });
    }

    // Check scale-down conditions
    if (currentMetrics.cpu < this.config.scalingThresholds.scaleDownCpu &&
        currentMetrics.cpu > 0) {
      recommendations.push({
        type: 'horizontal',
        resource: 'cpu',
        currentValue: currentMetrics.cpu,
        recommendedValue: Math.max(currentMetrics.cpu * 0.7, 20),
        reason: 'CPU usage below scale-down threshold',
        priority: 'low',
        estimatedImpact: {
          performance: -10,
          cost: -20
        },
        timeframe: '24 hours'
      });
    }

    // Add forecast-based recommendations
    forecasts.forEach(forecast => {
      if (forecast.risk === 'high') {
        recommendations.push({
          type: 'auto',
          resource: forecast.metric,
          currentValue: forecast.currentValue,
          recommendedValue: forecast.forecastedValue * 0.8, // Proactive scaling
          reason: `Forecasted ${forecast.metric} usage will exceed threshold in ${forecast.timeframe}`,
          priority: forecast.risk === 'high' ? 'high' : 'medium',
          estimatedImpact: {
            performance: 25,
            cost: 15
          },
          timeframe: '3 days'
        });
      }
    });

    this.recommendations.set(Date.now().toString(), recommendations);
    return recommendations;
  }

  private analyzeCostOptimization(): {
    currentCost: number;
    potentialSavings: number;
    recommendations: string[];
  } {
    if (!this.config.costOptimization.enabled) {
      return { currentCost: 0, potentialSavings: 0, recommendations: [] };
    }

    const recentMetrics = this.getRecentMetrics(7);
    if (recentMetrics.length === 0) {
      return { currentCost: 0, potentialSavings: 0, recommendations: [] };
    }

    const currentCost = recentMetrics.reduce((sum, metric) => sum + (metric.cost || 0), 0) / recentMetrics.length;
    const avgCpu = recentMetrics.reduce((sum, metric) => sum + metric.cpu, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, metric) => sum + metric.memory, 0) / recentMetrics.length;

    const targetUtilization = this.config.costOptimization.targetUtilization;
    const currentUtilization = (avgCpu + avgMemory) / 2;

    let potentialSavings = 0;
    const recommendations: string[] = [];

    if (currentUtilization < targetUtilization * 0.5) {
      potentialSavings = currentCost * 0.3; // 30% potential savings
      recommendations.push('Consider scaling down resources - utilization is below 50% of target');
    }

    if (avgCpu < 20) {
      potentialSavings += currentCost * 0.1;
      recommendations.push('CPU utilization is very low - consider right-sizing instances');
    }

    if (avgMemory < 30) {
      potentialSavings += currentCost * 0.1;
      recommendations.push('Memory utilization is low - consider reducing allocated memory');
    }

    return {
      currentCost,
      potentialSavings,
      recommendations
    };
  }

  // Alert Management
  private checkCapacityAlerts(): void {
    if (!this.config.alertingEnabled) return;

    const currentMetrics = this.getCurrentCapacityMetrics();

    // Check each resource against thresholds
    Object.entries(this.config.alertThresholds).forEach(([resource, threshold]) => {
      const value = currentMetrics[resource as keyof CapacityMetrics];
      if (value > threshold) {
        this.triggerCapacityAlert(resource as keyof CapacityMetrics, value, threshold);
      }
    });

    // Check forecasts for future capacity issues
    const forecasts = this.generateForecasts();
    forecasts.forEach(forecast => {
      if (forecast.risk === 'high') {
        this.triggerForecastAlert(forecast);
      }
    });
  }

  private triggerCapacityAlert(resource: keyof CapacityMetrics, value: number, threshold: number): void {
    this.emitEvent({
      id: `capacity_alert_${resource}_${Date.now()}`,
      type: 'custom',
      source: 'capacity_planner',
      timestamp: Date.now(),
      data: {
        action: 'capacity_alert',
        resource,
        value,
        threshold,
        message: `${resource.toUpperCase()} usage (${value.toFixed(1)}%) exceeds threshold (${threshold}%)`
      },
      tags: { resource, severity: 'warning' }
    });
  }

  private triggerForecastAlert(forecast: CapacityForecast): void {
    this.emitEvent({
      id: `forecast_alert_${forecast.metric}_${Date.now()}`,
      type: 'custom',
      source: 'capacity_planner',
      timestamp: Date.now(),
      data: {
        action: 'forecast_alert',
        forecast,
        message: `${forecast.metric.toUpperCase()} forecast shows high risk in ${forecast.timeframe}`
      },
      tags: { resource: forecast.metric, severity: 'warning' }
    });
  }

  // Reporting
  public generateCapacityReport(period: { start: number; end: number }): CapacityPlanningReport {
    const periodMetrics = this.getMetricsInPeriod(period);
    const analysis = this.performCapacityAnalysis();
    const bottlenecks = this.identifyBottlenecks(periodMetrics);

    return {
      generatedAt: Date.now(),
      period,
      summary: {
        currentUtilization: this.calculateAverageUtilization(periodMetrics),
        projectedUtilization: this.calculateProjectedUtilization(analysis.forecasts),
        riskAssessment: this.assessOverallRisk(analysis),
        recommendations: analysis.recommendations
      },
      detailedAnalysis: {
        resourceTrends: this.analyzeAllResourceTrends(periodMetrics),
        bottleneckAnalysis: bottlenecks,
        costAnalysis: this.analyzeCosts(periodMetrics)
      },
      actionItems: this.generateActionItems(analysis, bottlenecks)
    };
  }

  private getMetricsInPeriod(period: { start: number; end: number }): CapacityMetrics[] {
    const metrics: CapacityMetrics[] = [];

    this.historicalMetrics.forEach(dayMetrics => {
      dayMetrics.forEach(metric => {
        if (metric.timestamp >= period.start && metric.timestamp <= period.end) {
          metrics.push(metric);
        }
      });
    });

    return metrics.sort((a, b) => a.timestamp - b.timestamp);
  }

  private calculateAverageUtilization(metrics: CapacityMetrics[]): ResourceUsage {
    if (metrics.length === 0) {
      return {
        cpu: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        memory: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        disk: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        network: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' }
      };
    }

    const avgCpu = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length;
    const avgDisk = metrics.reduce((sum, m) => sum + m.disk, 0) / metrics.length;
    const avgNetwork = metrics.reduce((sum, m) => sum + m.network, 0) / metrics.length;

    return {
      cpu: { used: avgCpu, available: 100 - avgCpu, total: 100, percentage: avgCpu, unit: '%', trend: 'stable' },
      memory: { used: avgMemory, available: 100 - avgMemory, total: 100, percentage: avgMemory, unit: '%', trend: 'stable' },
      disk: { used: avgDisk, available: 100 - avgDisk, total: 100, percentage: avgDisk, unit: '%', trend: 'stable' },
      network: { used: avgNetwork, available: 100 - avgNetwork, total: 100, percentage: avgNetwork, unit: '%', trend: 'stable' }
    };
  }

  private calculateProjectedUtilization(forecasts: CapacityForecast[]): ResourceUsage {
    // Simple projection based on forecasts
    const projectedCpu = forecasts.find(f => f.metric === 'cpu')?.forecastedValue || 0;
    const projectedMemory = forecasts.find(f => f.metric === 'memory')?.forecastedValue || 0;
    const projectedDisk = forecasts.find(f => f.metric === 'disk')?.forecastedValue || 0;
    const projectedNetwork = forecasts.find(f => f.metric === 'network')?.forecastedValue || 0;

    return {
      cpu: { used: projectedCpu, available: 100 - projectedCpu, total: 100, percentage: projectedCpu, unit: '%', trend: 'stable' },
      memory: { used: projectedMemory, available: 100 - projectedMemory, total: 100, percentage: projectedMemory, unit: '%', trend: 'stable' },
      disk: { used: projectedDisk, available: 100 - projectedDisk, total: 100, percentage: projectedDisk, unit: '%', trend: 'stable' },
      network: { used: projectedNetwork, available: 100 - projectedNetwork, total: 100, percentage: projectedNetwork, unit: '%', trend: 'stable' }
    };
  }

  private assessOverallRisk(analysis: CapacityAnalysis): 'low' | 'medium' | 'high' {
    const highRiskForecasts = analysis.forecasts.filter(f => f.risk === 'high').length;
    const highPriorityRecommendations = analysis.recommendations.filter(r => r.priority === 'high').length;

    if (highRiskForecasts > 1 || highPriorityRecommendations > 2) {
      return 'high';
    }

    if (highRiskForecasts > 0 || highPriorityRecommendations > 0) {
      return 'medium';
    }

    return 'low';
  }

  private analyzeAllResourceTrends(metrics: CapacityMetrics[]): Record<string, GrowthModel> {
    const trends: Record<string, GrowthModel> = {};

    const resources: (keyof CapacityMetrics)[] = ['cpu', 'memory', 'disk', 'network'];
    resources.forEach(resource => {
      const values = metrics.map(m => m[resource] as number).filter(v => v > 0);
      if (values.length > 7) {
        trends[resource] = this.fitLinearModel(values);
      }
    });

    return trends;
  }

  private identifyBottlenecks(metrics: CapacityMetrics[]): {
    primaryBottleneck: string;
    secondaryBottlenecks: string[];
    projectedFailureTime?: number;
  } {
    if (metrics.length === 0) {
      return {
        primaryBottleneck: 'none',
        secondaryBottlenecks: []
      };
    }

    const avgCpu = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length;
    const avgDisk = metrics.reduce((sum, m) => sum + m.disk, 0) / metrics.length;
    const avgNetwork = metrics.reduce((sum, m) => sum + m.network, 0) / metrics.length;

    const resourceUsage = [
      { name: 'cpu', value: avgCpu },
      { name: 'memory', value: avgMemory },
      { name: 'disk', value: avgDisk },
      { name: 'network', value: avgNetwork }
    ];

    resourceUsage.sort((a, b) => b.value - a.value);

    const primaryBottleneck = resourceUsage[0].value > 80 ? resourceUsage[0].name : 'none';
    const secondaryBottlenecks = resourceUsage
      .slice(1, 3)
      .filter(r => r.value > 70)
      .map(r => r.name);

    let projectedFailureTime;
    if (primaryBottleneck !== 'none') {
      const growthRate = this.calculateGrowthRate(metrics.map(m => m[primaryBottleneck as keyof CapacityMetrics] as number));
      if (growthRate > 0) {
        const currentValue = resourceUsage[0].value;
        const threshold = this.config.alertThresholds[primaryBottleneck as keyof CapacityMetrics];
        const timeToThreshold = (threshold - currentValue) / (growthRate / 86400); // Convert to days
        projectedFailureTime = Date.now() + (timeToThreshold * 24 * 60 * 60 * 1000);
      }
    }

    return {
      primaryBottleneck,
      secondaryBottlenecks,
      projectedFailureTime
    };
  }

  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    return secondAvg - firstAvg;
  }

  private analyzeCosts(metrics: CapacityMetrics[]): {
    currentCost: number;
    projectedCost: number;
    optimizationOpportunities: string[];
  } {
    const currentCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0) / metrics.length;

    // Simple projection - assume linear growth
    const growthRate = this.calculateGrowthRate(metrics.map(m => m.cost || 0));
    const projectedCost = currentCost + (growthRate * 30); // 30 days projection

    const optimizationOpportunities: string[] = [];

    const avgCpu = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length;

    if (avgCpu < 30) {
      optimizationOpportunities.push('CPU utilization is low - consider right-sizing');
    }

    if (avgMemory < 40) {
      optimizationOpportunities.push('Memory utilization is low - consider reducing allocated memory');
    }

    if (metrics.length > 30) {
      const recentTrend = this.calculateGrowthRate(metrics.slice(-30).map(m => m.cost || 0));
      if (recentTrend > 0) {
        optimizationOpportunities.push('Cost is trending upward - investigate usage patterns');
      }
    }

    return {
      currentCost,
      projectedCost,
      optimizationOpportunities
    };
  }

  private generateActionItems(analysis: CapacityAnalysis, bottlenecks: any): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // High priority recommendations
    analysis.recommendations
      .filter(r => r.priority === 'high')
      .forEach(r => {
        immediate.push(`Scale ${r.resource} ${r.type === 'horizontal' ? 'horizontally' : 'vertically'} - ${r.reason}`);
      });

    // Bottleneck actions
    if (bottlenecks.primaryBottleneck !== 'none') {
      immediate.push(`Address ${bottlenecks.primaryBottleneck} bottleneck - primary performance constraint`);
    }

    bottlenecks.secondaryBottlenecks.forEach(bottleneck => {
      shortTerm.push(`Optimize ${bottleneck} usage - secondary bottleneck identified`);
    });

    // Cost optimization
    if (analysis.costOptimization.potentialSavings > 10) {
      shortTerm.push(`Implement cost optimization measures - potential savings: $${analysis.costOptimization.potentialSavings.toFixed(2)}/month`);
    }

    // Forecast-based actions
    analysis.forecasts
      .filter(f => f.risk === 'high')
      .forEach(f => {
        shortTerm.push(`Plan capacity expansion for ${f.metric} - high risk forecast`);
        longTerm.push(`Review long-term capacity strategy for ${f.metric}`);
      });

    return { immediate, shortTerm, longTerm };
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);

    // Clean up historical metrics
    this.historicalMetrics.forEach((metrics, key) => {
      if (new Date(key).getTime() < cutoff) {
        this.historicalMetrics.delete(key);
      }
    });

    // Clean up analysis history
    this.analysisHistory = this.analysisHistory.filter(analysis =>
      analysis.timestamp >= cutoff
    );

    // Clean up forecasts
    this.forecasts.forEach((forecasts, key) => {
      if (parseInt(key) < cutoff) {
        this.forecasts.delete(key);
      }
    });

    // Clean up recommendations
    this.recommendations.forEach((recommendations, key) => {
      if (parseInt(key) < cutoff) {
        this.recommendations.delete(key);
      }
    });
  }

  private emitEvent(event: MonitoringEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in capacity planner event listener:', error);
      }
    });
  }

  public addEventListener(listener: (event: MonitoringEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // Public API
  public getCapacityAnalysis(): CapacityAnalysis | null {
    return this.analysisHistory[this.analysisHistory.length - 1] || null;
  }

  public getForecasts(): CapacityForecast[] {
    const allForecasts: CapacityForecast[] = [];
    this.forecasts.forEach(forecasts => {
      allForecasts.push(...forecasts);
    });
    return allForecasts;
  }

  public getRecommendations(): ScalingRecommendation[] {
    const allRecommendations: ScalingRecommendation[] = [];
    this.recommendations.forEach(recommendations => {
      allRecommendations.push(...recommendations);
    });
    return allRecommendations;
  }

  public getHistoricalMetrics(days: number = 30): CapacityMetrics[] {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const metrics: CapacityMetrics[] = [];

    this.historicalMetrics.forEach(dayMetrics => {
      dayMetrics.forEach(metric => {
        if (metric.timestamp >= cutoff) {
          metrics.push(metric);
        }
      });
    });

    return metrics.sort((a, b) => a.timestamp - b.timestamp);
  }

  public getConfig(): CapacityPlanningConfig {
    return { ...this.config };
  }

  public updateConfig(config: Partial<CapacityPlanningConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
  }
}

// Export singleton instance
export const capacityPlanner = CapacityPlanner.getInstance();

// Export utility functions
export const performCapacityAnalysis = () => capacityPlanner.performCapacityAnalysis();
export const generateCapacityReport = (period: { start: number; end: number }) => capacityPlanner.generateCapacityReport(period);
export const getCapacityForecasts = () => capacityPlanner.getForecasts();
export const getScalingRecommendations = () => capacityPlanner.getRecommendations();
export const getHistoricalMetrics = (days?: number) => capacityPlanner.getHistoricalMetrics(days);