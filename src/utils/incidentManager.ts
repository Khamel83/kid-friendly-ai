/**
 * Incident management system for the kid-friendly-ai monitoring
 * Provides incident detection, classification, response automation, communication workflows,
 * resolution tracking, post-mortem generation, trend analysis, and prevention insights
 */

import {
  Incident,
  IncidentImpact,
  IncidentCategory,
  IncidentTimelineEntry,
  IncidentAction,
  PostMortem,
  PostMortemAction,
  Alert,
  AlertSeverity,
  MonitoringEvent
} from '../types/monitoring';
import { monitoringManager } from './monitoringManager';
import { alertManager } from './alertManager';

export interface IncidentManagerConfig {
  autoCreateEnabled: boolean;
  autoAssignEnabled: boolean;
  escalationEnabled: boolean;
  communicationEnabled: boolean;
  postMortemEnabled: boolean;
  defaultAssignee?: string;
  escalationPolicy?: string;
  communicationChannels: string[];
  severityThresholds: {
    critical: number;
    error: number;
    warning: number;
  };
}

export interface IncidentTemplate {
  id: string;
  name: string;
  category: IncidentCategory;
  description: string;
  impact: IncidentImpact;
  severity: AlertSeverity;
  autoActions: IncidentAction[];
  communicationTemplate?: string;
  investigationSteps: string[];
}

export interface IncidentCorrelationRule {
  id: string;
  name: string;
  description: string;
  conditions: CorrelationCondition[];
  action: 'merge' | 'relate' | 'create_parent';
  timeWindow: number;
}

export interface CorrelationCondition {
  alertRule?: string;
  severity?: AlertSeverity;
  category?: IncidentCategory;
  service?: string;
  timeRange?: number;
}

export interface IncidentAnalytics {
  totalIncidents: number;
  incidentsByCategory: Record<IncidentCategory, number>;
  incidentsBySeverity: Record<AlertSeverity, number>;
  averageResolutionTime: number;
  averageResponseTime: number;
  mttr: number; // Mean Time To Resolution
  mtbf: number; // Mean Time Between Failures
  recurringIssues: string[];
  topCauses: string[];
  systemHealthScore: number;
}

export class IncidentManager {
  private static instance: IncidentManager;
  private config: IncidentManagerConfig;
  private incidents: Map<string, Incident> = new Map();
  private templates: Map<string, IncidentTemplate> = new Map();
  private correlationRules: Map<string, IncidentCorrelationRule> = new Map();
  private eventListeners: Set<(event: MonitoringEvent) => void> = new Set();
  private processingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initialize();
  }

  static getInstance(): IncidentManager {
    if (!IncidentManager.instance) {
      IncidentManager.instance = new IncidentManager();
    }
    return IncidentManager.instance;
  }

  private getDefaultConfig(): IncidentManagerConfig {
    return {
      autoCreateEnabled: true,
      autoAssignEnabled: true,
      escalationEnabled: true,
      communicationEnabled: true,
      postMortemEnabled: true,
      communicationChannels: ['slack', 'email'],
      severityThresholds: {
        critical: 1,
        error: 3,
        warning: 5
      }
    };
  }

  private initialize(): void {
    this.setupDefaultTemplates();
    this.setupCorrelationRules();
    this.startProcessing();
  }

  private setupDefaultTemplates(): void {
    // API Service Outage Template
    this.createIncidentTemplate({
      id: 'api_service_outage',
      name: 'API Service Outage',
      category: 'availability',
      description: 'API services are experiencing downtime or severe degradation',
      impact: {
        scope: 'service',
        affectedUsers: 1000,
        businessImpact: 'high',
        slaBreach: true
      },
      severity: 'critical',
      autoActions: [
        {
          id: 'check_api_health',
          type: 'investigation',
          description: 'Check API health endpoints',
          assignedTo: 'system',
          status: 'pending',
          createdAt: Date.now()
        },
        {
          id: 'notify_on_call',
          type: 'communication',
          description: 'Notify on-call engineer',
          assignedTo: 'system',
          status: 'pending',
          createdAt: Date.now()
        }
      ],
      communicationTemplate: '🚨 **API SERVICE OUTAGE**: {description}\n\nImpact: {impact}\nInvestigation in progress.',
      investigationSteps: [
        'Check API health endpoints',
        'Verify service dependencies',
        'Review recent deployments',
        'Check system metrics'
      ]
    });

    // Performance Degradation Template
    this.createIncidentTemplate({
      id: 'performance_degradation',
      name: 'Performance Degradation',
      category: 'performance',
      description: 'System performance has degraded beyond acceptable thresholds',
      impact: {
        scope: 'system',
        affectedUsers: 500,
        businessImpact: 'medium',
        slaBreach: false
      },
      severity: 'error',
      autoActions: [
        {
          id: 'analyze_performance',
          type: 'investigation',
          description: 'Analyze performance metrics',
          assignedTo: 'system',
          status: 'pending',
          createdAt: Date.now()
        }
      ],
      communicationTemplate: '⚠️ **PERFORMANCE DEGRADATION**: {description}\n\nImpact: {impact}',
      investigationSteps: [
        'Review performance metrics',
        'Identify bottlenecks',
        'Check recent changes',
        'Analyze resource usage'
      ]
    });

    // Database Issue Template
    this.createIncidentTemplate({
      id: 'database_issue',
      name: 'Database Connectivity Issue',
      category: 'infrastructure',
      description: 'Database connectivity or performance issues',
      impact: {
        scope: 'service',
        affectedUsers: 2000,
        businessImpact: 'high',
        slaBreach: true
      },
      severity: 'critical',
      autoActions: [
        {
          id: 'check_database',
          type: 'investigation',
          description: 'Check database connectivity and performance',
          assignedTo: 'system',
          status: 'pending',
          createdAt: Date.now()
        }
      ],
      communicationTemplate: '🚨 **DATABASE ISSUE**: {description}\n\nImpact: {impact}',
      investigationSteps: [
        'Test database connectivity',
        'Check database metrics',
        'Review query performance',
        'Check database logs'
      ]
    });
  }

  private setupCorrelationRules(): void {
    // Multiple critical alerts correlation
    this.createCorrelationRule({
      id: 'multiple_critical_alerts',
      name: 'Multiple Critical Alerts',
      description: 'Correlate multiple critical alerts within time window',
      conditions: [
        { severity: 'critical' }
      ],
      action: 'create_parent',
      timeWindow: 300000 // 5 minutes
    });

    // Same service correlation
    this.createCorrelationRule({
      id: 'same_service_alerts',
      name: 'Same Service Alerts',
      description: 'Correlate alerts from the same service',
      conditions: [
        { severity: 'error' }
      ],
      action: 'merge',
      timeWindow: 600000 // 10 minutes
    });

    // Performance chain correlation
    this.createCorrelationRule({
      id: 'performance_chain',
      name: 'Performance Chain',
      description: 'Correlate performance-related alerts',
      conditions: [
        { category: 'performance' }
      ],
      action: 'relate',
      timeWindow: 900000 // 15 minutes
    });
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.checkForIncidents();
      this.processAutoActions();
      this.checkEscalations();
      this.updateIncidentMetrics();
    }, 30000); // Every 30 seconds
  }

  // Incident Creation and Management
  public createIncident(incidentData: Partial<Incident>): Incident {
    const incident: Incident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: incidentData.title || 'Untitled Incident',
      description: incidentData.description || 'No description provided',
      severity: incidentData.severity || 'error',
      status: 'open',
      impact: incidentData.impact || {
        scope: 'system',
        affectedUsers: 0,
        businessImpact: 'medium'
      },
      category: incidentData.category || 'performance',
      createdBy: incidentData.createdBy || 'system',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      alerts: incidentData.alerts || [],
      timeline: [{
        timestamp: Date.now(),
        type: 'created',
        message: 'Incident created',
        user: incidentData.createdBy || 'system'
      }],
      actions: incidentData.actions || []
    };

    // Apply template if available
    this.applyIncidentTemplate(incident);

    // Auto-assign if enabled
    if (this.config.autoAssignEnabled && this.config.defaultAssignee) {
      incident.assignee = this.config.defaultAssignee;
      this.addTimelineEntry(incident.id, 'assigned', `Assigned to ${this.config.defaultAssignee}`, 'system');
    }

    // Auto-execute actions
    if (incident.actions) {
      incident.actions.forEach(action => {
        this.executeAction(incident.id, action.id);
      });
    }

    this.incidents.set(incident.id, incident);
    this.notifyIncidentCreated(incident);

    this.emitEvent({
      id: `incident_created_${incident.id}`,
      type: 'incident',
      source: 'incident_manager',
      timestamp: incident.createdAt,
      data: { action: 'incident_created', incident },
      tags: { incidentId: incident.id, severity: incident.severity }
    });

    return incident;
  }

  private applyIncidentTemplate(incident: Incident): void {
    const template = this.templates.get(this.getTemplateIdForIncident(incident));
    if (!template) return;

    // Apply template properties
    incident.category = template.category;
    incident.impact = template.impact;
    incident.severity = template.severity;

    // Add auto actions
    template.autoActions.forEach(autoAction => {
      const action: IncidentAction = {
        ...autoAction,
        id: `${autoAction.id}_${Date.now()}`,
        createdAt: Date.now()
      };
      incident.actions.push(action);
    });
  }

  private getTemplateIdForIncident(incident: Incident): string {
    // Simple template matching logic
    if (incident.title.toLowerCase().includes('api') || incident.title.toLowerCase().includes('service')) {
      return 'api_service_outage';
    }
    if (incident.title.toLowerCase().includes('performance') || incident.title.toLowerCase().includes('slow')) {
      return 'performance_degradation';
    }
    if (incident.title.toLowerCase().includes('database') || incident.title.toLowerCase().includes('db')) {
      return 'database_issue';
    }
    return '';
  }

  public updateIncident(id: string, updates: Partial<Incident>): void {
    const incident = this.incidents.get(id);
    if (!incident) return;

    const oldStatus = incident.status;
    Object.assign(incident, updates, { updatedAt: Date.now() });

    // Add timeline entry for status changes
    if (updates.status && updates.status !== oldStatus) {
      this.addTimelineEntry(id, 'updated', `Status changed to ${updates.status}`, 'system');
    }

    this.incidents.set(id, incident);
    this.emitEvent({
      id: `incident_updated_${id}`,
      type: 'incident',
      source: 'incident_manager',
      timestamp: Date.now(),
      data: { action: 'incident_updated', incident },
      tags: { incidentId: id, status: incident.status }
    });
  }

  public assignIncident(id: string, assignee: string, message?: string): void {
    const incident = this.incidents.get(id);
    if (!incident) return;

    incident.assignee = assignee;
    incident.updatedAt = Date.now();

    this.addTimelineEntry(id, 'assigned', `Assigned to ${assignee}${message ? `: ${message}` : ''}`, 'system');
    this.incidents.set(id, incident);
  }

  public escalateIncident(id: string, level: number, reason: string): void {
    const incident = this.incidents.get(id);
    if (!incident) return;

    this.addTimelineEntry(id, 'escalated', `Escalated to level ${level}: ${reason}`, 'system');
    incident.updatedAt = Date.now();

    // Send escalation notifications
    this.sendEscalationNotification(incident, level, reason);
  }

  public resolveIncident(id: string, resolution: string, resolvedBy: string): void {
    const incident = this.incidents.get(id);
    if (!incident) return;

    incident.status = 'resolved';
    incident.resolution = resolution;
    incident.resolvedAt = Date.now();
    incident.updatedAt = Date.now();

    this.addTimelineEntry(id, 'resolved', `Resolved: ${resolution}`, resolvedBy);
    this.incidents.set(id, incident);

    // Auto-generate post-mortem if enabled
    if (this.config.postMortemEnabled) {
      this.generatePostMortem(incident);
    }
  }

  public closeIncident(id: string, closedBy: string): void {
    const incident = this.incidents.get(id);
    if (!incident) return;

    incident.status = 'closed';
    incident.closedAt = Date.now();
    incident.updatedAt = Date.now();

    this.addTimelineEntry(id, 'closed', 'Incident closed', closedBy);
    this.incidents.set(id, incident);
  }

  public addTimelineEntry(id: string, type: IncidentTimelineEntry['type'], message: string, user: string, details?: Record<string, any>): void {
    const incident = this.incidents.get(id);
    if (!incident) return;

    incident.timeline.push({
      timestamp: Date.now(),
      type,
      message,
      user,
      details
    });

    incident.updatedAt = Date.now();
    this.incidents.set(id, incident);
  }

  public addAction(incidentId: string, action: Omit<IncidentAction, 'id' | 'createdAt'>): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const newAction: IncidentAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };

    incident.actions.push(newAction);
    incident.updatedAt = Date.now();

    this.addTimelineEntry(incidentId, 'updated', `Action added: ${action.description}`, 'system');
    this.incidents.set(incidentId, incident);

    // Auto-execute action if assigned to system
    if (action.assignedTo === 'system') {
      this.executeAction(incidentId, newAction.id);
    }
  }

  public completeAction(incidentId: string, actionId: string, result: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const action = incident.actions.find(a => a.id === actionId);
    if (!action) return;

    action.status = 'completed';
    action.completedAt = Date.now();
    action.result = result;

    incident.updatedAt = Date.now();
    this.addTimelineEntry(incidentId, 'updated', `Action completed: ${action.description}`, 'system');
    this.incidents.set(incidentId, incident);
  }

  // Auto-incident Creation
  private checkForIncidents(): void {
    if (!this.config.autoCreateEnabled) return;

    const alerts = alertManager.getAlerts('active');
    const recentAlerts = alerts.filter(alert => Date.now() - alert.timestamp < 300000); // Last 5 minutes

    // Check severity thresholds
    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical');
    const errorAlerts = recentAlerts.filter(a => a.severity === 'error');
    const warningAlerts = recentAlerts.filter(a => a.severity === 'warning');

    // Create incidents based on thresholds
    if (criticalAlerts.length >= this.config.severityThresholds.critical) {
      this.createIncidentFromAlerts(criticalAlerts, 'critical');
    } else if (errorAlerts.length >= this.config.severityThresholds.error) {
      this.createIncidentFromAlerts(errorAlerts, 'error');
    } else if (warningAlerts.length >= this.config.severityThresholds.warning) {
      this.createIncidentFromAlerts(warningAlerts, 'warning');
    }

    // Apply correlation rules
    this.applyCorrelationRules(recentAlerts);
  }

  private createIncidentFromAlerts(alerts: Alert[], severity: AlertSeverity): void {
    const uniqueServices = [...new Set(alerts.map(a => a.ruleId))];
    const incidentTitle = `${severity === 'critical' ? 'Critical' : 'Multiple'} Alert${alerts.length > 1 ? 's' : ''}: ${uniqueServices.join(', ')}`;

    const existingIncident = Array.from(this.incidents.values()).find(incident =>
      incident.status === 'open' && incident.alerts.some(alertId => alerts.some(a => a.id === alertId))
    );

    if (existingIncident) {
      // Update existing incident
      const newAlertIds = alerts.filter(a => !existingIncident.alerts.includes(a.id)).map(a => a.id);
      existingIncident.alerts.push(...newAlertIds);
      existingIncident.updatedAt = Date.now();
      this.incidents.set(existingIncident.id, existingIncident);
      return;
    }

    // Create new incident
    this.createIncident({
      title: incidentTitle,
      description: `Multiple ${severity} alerts detected: ${alerts.map(a => a.name).join(', ')}`,
      severity,
      category: 'performance',
      alerts: alerts.map(a => a.id),
      createdBy: 'system'
    });
  }

  private applyCorrelationRules(alerts: Alert[]): void {
    for (const rule of this.correlationRules.values()) {
      const matchingAlerts = alerts.filter(alert => this.matchesCorrelationCondition(alert, rule));

      if (matchingAlerts.length >= 2) {
        this.applyCorrelationAction(matchingAlerts, rule);
      }
    }
  }

  private matchesCorrelationCondition(alert: Alert, rule: IncidentCorrelationRule): boolean {
    return rule.conditions.some(condition => {
      if (condition.severity && alert.severity !== condition.severity) return false;
      // Add more condition matching logic as needed
      return true;
    });
  }

  private applyCorrelationAction(alerts: Alert[], rule: IncidentCorrelationRule): void {
    switch (rule.action) {
      case 'create_parent':
        this.createParentIncident(alerts);
        break;
      case 'merge':
        this.mergeAlertIncidents(alerts);
        break;
      case 'relate':
        this.relateAlertIncidents(alerts);
        break;
    }
  }

  private createParentIncident(alerts: Alert[]): void {
    const parentIncident = this.createIncident({
      title: 'Multiple Related Alerts',
      description: `Multiple related alerts detected requiring coordinated response`,
      severity: 'error',
      category: 'performance',
      alerts: alerts.map(a => a.id),
      createdBy: 'system'
    });

    // Resolve child alerts
    alerts.forEach(alert => {
      alertManager.resolveAlert(alert.id, 'system', 'Merged into parent incident');
    });
  }

  private mergeAlertIncidents(alerts: Alert[]): void {
    // Find existing incidents for these alerts
    const relatedIncidents = Array.from(this.incidents.values()).filter(incident =>
      incident.status === 'open' && incident.alerts.some(alertId => alerts.some(a => a.id === alertId))
    );

    if (relatedIncidents.length > 1) {
      // Merge into first incident
      const primaryIncident = relatedIncidents[0];
      const otherIncidents = relatedIncidents.slice(1);

      // Combine alerts and actions
      otherIncidents.forEach(incident => {
        primaryIncident.alerts.push(...incident.alerts.filter(id => !primaryIncident.alerts.includes(id)));
        primaryIncident.actions.push(...incident.actions);
        this.closeIncident(incident.id, 'system');
      });

      primaryIncident.updatedAt = Date.now();
      this.incidents.set(primaryIncident.id, primaryIncident);
    }
  }

  private relateAlertIncidents(alerts: Alert[]): void {
    // Find existing incidents and mark them as related
    const relatedIncidents = Array.from(this.incidents.values()).filter(incident =>
      incident.status === 'open' && incident.alerts.some(alertId => alerts.some(a => a.id === alertId))
    );

    relatedIncidents.forEach(incident => {
      this.addTimelineEntry(incident.id, 'updated', 'Related alerts detected', 'system', { relatedAlerts: alerts.map(a => a.id) });
    });
  }

  // Action Processing
  private processAutoActions(): void {
    this.incidents.forEach(incident => {
      if (incident.status !== 'open') return;

      incident.actions.forEach(action => {
        if (action.status === 'pending' && action.assignedTo === 'system') {
          this.executeAction(incident.id, action.id);
        }
      });
    });
  }

  private executeAction(incidentId: string, actionId: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const action = incident.actions.find(a => a.id === actionId);
    if (!action || action.status !== 'pending') return;

    action.status = 'in_progress';
    this.incidents.set(incidentId, incident);

    // Execute action based on type
    setTimeout(() => {
      let result = '';
      switch (action.type) {
        case 'investigation':
          result = this.executeInvestigationAction(incident, action);
          break;
        case 'mitigation':
          result = this.executeMitigationAction(incident, action);
          break;
        case 'communication':
          result = this.executeCommunicationAction(incident, action);
          break;
        default:
          result = 'Action completed';
      }

      this.completeAction(incidentId, actionId, result);
    }, 5000); // Simulate action execution time
  }

  private executeInvestigationAction(incident: Incident, action: IncidentAction): string {
    // Simulate investigation logic
    return `Investigation completed for: ${action.description}`;
  }

  private executeMitigationAction(incident: Incident, action: IncidentAction): string {
    // Simulate mitigation logic
    return `Mitigation applied for: ${action.description}`;
  }

  private executeCommunicationAction(incident: Incident, action: IncidentAction): string {
    // Send communication notifications
    this.sendIncidentNotification(incident, action.description);
    return `Communication sent for: ${action.description}`;
  }

  // Escalation Management
  private checkEscalations(): void {
    if (!this.config.escalationEnabled) return;

    const openIncidents = Array.from(this.incidents.values()).filter(incident => incident.status === 'open');

    openIncidents.forEach(incident => {
      const timeSinceCreation = Date.now() - incident.createdAt;

      // Escalate based on severity and time
      if (incident.severity === 'critical' && timeSinceCreation > 900000) { // 15 minutes
        this.escalateIncident(incident.id, 2, 'Critical incident not resolved within 15 minutes');
      } else if (incident.severity === 'error' && timeSinceCreation > 1800000) { // 30 minutes
        this.escalateIncident(incident.id, 1, 'Error incident not resolved within 30 minutes');
      }
    });
  }

  private sendEscalationNotification(incident: Incident, level: number, reason: string): void {
    const message = `🚨 **ESCALATION (${level})**: ${incident.title}\n\nReason: ${reason}\nTime since creation: ${Math.round((Date.now() - incident.createdAt) / 60000)} minutes`;

    this.sendIncidentNotification(incident, message);
  }

  private sendIncidentNotification(incident: Incident, message: string): void {
    // Send notifications through configured channels
    if (this.config.communicationEnabled) {
      this.config.communicationChannels.forEach(channel => {
        console.log(`[${channel.toUpperCase()}] ${message}`);
      });
    }
  }

  // Post-Mortem Generation
  private generatePostMortem(incident: Incident): void {
    if (!this.config.postMortemEnabled || !incident.resolvedAt) return;

    const resolutionTime = incident.resolvedAt - incident.createdAt;

    const postMortem: PostMortem = {
      summary: `Analysis of ${incident.title}`,
      timeline: this.generateTimelineSummary(incident),
      rootCause: this.determineRootCause(incident),
      impact: `Affected ${incident.impact.affectedUsers} users with ${incident.impact.businessImpact} business impact`,
      resolution: incident.resolution || 'No resolution documented',
      lessonsLearned: this.generateLessonsLearned(incident),
      actionItems: this.generateActionItems(incident),
      createdAt: Date.now(),
      author: 'system'
    };

    incident.postMortem = postMortem;
    this.incidents.set(incident.id, incident);

    this.emitEvent({
      id: `post_mortem_generated_${incident.id}`,
      type: 'custom',
      source: 'incident_manager',
      timestamp: Date.now(),
      data: { action: 'post_mortem_generated', incident, postMortem },
      tags: { incidentId: incident.id }
    });
  }

  private generateTimelineSummary(incident: Incident): string {
    return incident.timeline
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(entry => `${new Date(entry.timestamp).toLocaleTimeString()}: ${entry.message} (${entry.user})`)
      .join('\n');
  }

  private determineRootCause(incident: Incident): string {
    // Simple root cause analysis based on incident data
    if (incident.category === 'infrastructure') {
      return 'Infrastructure-related issue identified';
    }
    if (incident.category === 'deployment') {
      return 'Recent deployment may have caused the issue';
    }
    return 'Root cause analysis in progress';
  }

  private generateLessonsLearned(incident: Incident): string[] {
    const lessons = [];

    if (incident.severity === 'critical') {
      lessons.push('Critical incidents require faster response times');
      lessons.push('Improve monitoring and alerting for critical systems');
    }

    if (incident.actions.some(a => a.type === 'investigation')) {
      lessons.push('Standardize investigation procedures');
    }

    lessons.push('Document incident response procedures');

    return lessons;
  }

  private generateActionItems(incident: Incident): PostMortemAction[] {
    return [
      {
        id: 'review_monitoring',
        description: 'Review and improve monitoring coverage',
        assignee: 'operations',
        dueDate: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'pending'
      },
      {
        id: 'update_runbook',
        description: 'Update incident response runbook',
        assignee: 'engineering',
        dueDate: Date.now() + (3 * 24 * 60 * 60 * 1000), // 3 days
        status: 'pending'
      }
    ];
  }

  // Analytics and Reporting
  private updateIncidentMetrics(): void {
    // Update incident analytics
    const analytics = this.getIncidentAnalytics();

    this.emitEvent({
      id: 'incident_metrics_updated',
      type: 'custom',
      source: 'incident_manager',
      timestamp: Date.now(),
      data: { action: 'metrics_updated', analytics },
      tags: {}
    });
  }

  public getIncidentAnalytics(): IncidentAnalytics {
    const incidents = Array.from(this.incidents.values());
    const now = Date.now();

    const totalIncidents = incidents.length;
    const incidentsByCategory = incidents.reduce((acc, incident) => {
      acc[incident.category] = (acc[incident.category] || 0) + 1;
      return acc;
    }, {} as Record<IncidentCategory, number>);

    const incidentsBySeverity = incidents.reduce((acc, incident) => {
      acc[incident.severity] = (acc[incident.severity] || 0) + 1;
      return acc;
    }, {} as Record<AlertSeverity, number>);

    const resolvedIncidents = incidents.filter(i => i.status === 'resolved' && i.resolvedAt);
    const averageResolutionTime = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, i) => sum + (i.resolvedAt! - i.createdAt), 0) / resolvedIncidents.length
      : 0;

    const mttr = averageResolutionTime;
    const mtbf = this.calculateMTBF(incidents);
    const systemHealthScore = this.calculateSystemHealthScore(incidents);

    return {
      totalIncidents,
      incidentsByCategory,
      incidentsBySeverity,
      averageResolutionTime,
      averageResponseTime: 0, // Would need to track first response time
      mttr,
      mtbf,
      recurringIssues: this.findRecurringIssues(incidents),
      topCauses: this.findTopCauses(incidents),
      systemHealthScore
    };
  }

  private calculateMTBF(incidents: Incident[]): number {
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved' && i.resolvedAt);
    if (resolvedIncidents.length < 2) return 0;

    const sortedIncidents = resolvedIncidents.sort((a, b) => a.resolvedAt! - b.resolvedAt!);
    let totalBF = 0;

    for (let i = 1; i < sortedIncidents.length; i++) {
      totalBF += sortedIncidents[i].createdAt - sortedIncidents[i - 1].resolvedAt!;
    }

    return totalBF / (sortedIncidents.length - 1);
  }

  private calculateSystemHealthScore(incidents: Incident[]): number {
    const recentIncidents = incidents.filter(i => Date.now() - i.createdAt < (7 * 24 * 60 * 60 * 1000)); // Last 7 days
    const criticalIncidents = recentIncidents.filter(i => i.severity === 'critical').length;
    const totalIncidents = recentIncidents.length;

    let score = 100;
    score -= (criticalIncidents * 10);
    score -= (totalIncidents * 2);

    return Math.max(0, Math.min(100, score));
  }

  private findRecurringIssues(incidents: Incident[]): string[] {
    const titlePatterns = incidents.map(i => i.title.toLowerCase());
    const patternCounts = titlePatterns.reduce((acc, title) => {
      const pattern = this.extractPattern(title);
      acc[pattern] = (acc[pattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(patternCounts)
      .filter(([_, count]) => count > 2)
      .map(([pattern]) => pattern);
  }

  private findTopCauses(incidents: Incident[]): string[] {
    const categories = incidents.map(i => i.category);
    const categoryCounts = categories.reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);
  }

  private extractPattern(title: string): string {
    // Simple pattern extraction
    return title.replace(/\d+/g, 'NUMBER')
      .replace(/api|service|database/g, 'SYSTEM')
      .toLowerCase();
  }

  // Template and Rule Management
  public createIncidentTemplate(template: IncidentTemplate): void {
    this.templates.set(template.id, template);
  }

  public createCorrelationRule(rule: IncidentCorrelationRule): void {
    this.correlationRules.set(rule.id, rule);
  }

  private notifyIncidentCreated(incident: Incident): void {
    // Send notifications about new incident
    this.sendIncidentNotification(incident, `🚨 **NEW INCIDENT**: ${incident.title}\n\n${incident.description}\nSeverity: ${incident.severity}`);
  }

  private emitEvent(event: MonitoringEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in incident manager event listener:', error);
      }
    });
  }

  public addEventListener(listener: (event: MonitoringEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // Public API
  public getIncidents(status?: Incident['status']): Incident[] {
    const incidents = Array.from(this.incidents.values());
    return status ? incidents.filter(incident => incident.status === status) : incidents;
  }

  public getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  public getConfig(): IncidentManagerConfig {
    return { ...this.config };
  }

  public updateConfig(config: Partial<IncidentManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

// Export singleton instance
export const incidentManager = IncidentManager.getInstance();

// Export utility functions
export const createIncident = (incidentData: Partial<Incident>) => incidentManager.createIncident(incidentData);
export const updateIncident = (id: string, updates: Partial<Incident>) => incidentManager.updateIncident(id, updates);
export const assignIncident = (id: string, assignee: string, message?: string) => incidentManager.assignIncident(id, assignee, message);
export const resolveIncident = (id: string, resolution: string, resolvedBy: string) => incidentManager.resolveIncident(id, resolution, resolvedBy);
export const closeIncident = (id: string, closedBy: string) => incidentManager.closeIncident(id, closedBy);
export const getIncidents = (status?: Incident['status']) => incidentManager.getIncidents(status);
export const getIncidentAnalytics = () => incidentManager.getIncidentAnalytics();