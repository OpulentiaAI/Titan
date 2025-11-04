// Guardrails Monitor Component
// Visual dashboard for permissions, audit logs, and security statistics

import React from 'react';
import {
  globalGuardrails,
  type AuditLogEntry,
  type GuardrailViolation,
} from '../../lib/guardrails';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Button } from './button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';
import { Progress } from './progress';

interface GuardrailsMonitorProps {
  refreshInterval?: number; // in ms, default 5000
}

export function GuardrailsMonitor({ refreshInterval = 5000 }: GuardrailsMonitorProps) {
  const [stats, setStats] = React.useState(globalGuardrails.getStats());
  const [auditLog, setAuditLog] = React.useState(globalGuardrails.getAuditLog());
  const [role, setRole] = React.useState(globalGuardrails.getRole());

  // Auto-refresh
  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(globalGuardrails.getStats());
      setAuditLog(globalGuardrails.getAuditLog());
      setRole(globalGuardrails.getRole());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const refresh = () => {
    setStats(globalGuardrails.getStats());
    setAuditLog(globalGuardrails.getAuditLog());
    setRole(globalGuardrails.getRole());
  };

  const successRate =
    stats.totalRequests > 0 ? (stats.allowed / stats.totalRequests) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <CardTitle>Guardrails Monitor</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Role: {role.name}
            </Badge>
            <Button variant="outline" size="sm" onClick={refresh}>
              <Activity className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
        <CardDescription>
          Permission-based tool execution monitoring and security audit
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Total Requests</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{stats.totalRequests}</p>
          </div>

          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Allowed</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{stats.allowed}</p>
            <p className="text-xs text-green-600 mt-1">{successRate.toFixed(1)}% success rate</p>
          </div>

          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-700">Blocked</span>
            </div>
            <p className="text-2xl font-bold text-red-900">{stats.blocked}</p>
          </div>

          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700">Requires Approval</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900">{stats.requiresApproval}</p>
          </div>
        </div>

        {/* Success Rate Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Success Rate</span>
            <span className="text-sm font-bold text-gray-900">{successRate.toFixed(1)}%</span>
          </div>
          <Progress value={successRate} className="h-3" />
        </div>

        {/* Violations */}
        {Object.keys(stats.violations).length > 0 && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Violations Detected
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(stats.violations).map(([type, count]) => (
                <div
                  key={type}
                  className="rounded bg-white border border-red-300 p-2 text-center"
                >
                  <p className="text-xs font-medium text-red-700 capitalize">
                    {type.replace('_', ' ')}
                  </p>
                  <p className="text-lg font-bold text-red-900">{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Tools */}
        {stats.topTools.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Most Used Tools
            </h3>
            <div className="space-y-2">
              {stats.topTools.slice(0, 5).map((item, index) => {
                const percentage =
                  stats.totalRequests > 0 ? (item.count / stats.totalRequests) * 100 : 0;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-600 w-32 truncate">
                      {item.tool}
                    </span>
                    <div className="flex-1">
                      <Progress value={percentage} className="h-2" />
                    </div>
                    <span className="text-xs font-semibold text-gray-900 w-12 text-right">
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Role Permissions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Current Role: {role.name}
          </h3>
          <p className="text-sm text-gray-600 mb-3">{role.description}</p>
          <div className="space-y-2">
            {role.permissions.map((permission, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <code className="text-xs font-mono text-gray-900">
                    {Array.isArray(permission.tool)
                      ? permission.tool.join(', ')
                      : permission.tool}
                  </code>
                  <PermissionLevelBadge level={permission.level} />
                </div>
                {permission.restrictions && permission.restrictions.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="font-medium">Restrictions:</span>{' '}
                    {permission.restrictions.map((r) => r.type).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Audit Log ({auditLog.length} entries)
          </h3>

          {auditLog.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No audit entries yet</p>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {auditLog.slice(-10).reverse().map((entry, index) => (
                <AuditLogItem key={index} entry={entry} />
              ))}
            </Accordion>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionLevelBadge({ level }: { level: string }) {
  const config = {
    public: { color: 'bg-green-50 text-green-700 border-green-200', label: 'Public' },
    restricted: { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Restricted' },
    admin: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Admin' },
    blocked: { color: 'bg-red-50 text-red-700 border-red-200', label: 'Blocked' },
  };

  const { color, label } = config[level as keyof typeof config] || config.public;

  return (
    <Badge variant="outline" className={`text-xs ${color}`}>
      {label}
    </Badge>
  );
}

interface AuditLogItemProps {
  entry: AuditLogEntry;
}

function AuditLogItem({ entry }: AuditLogItemProps) {
  const getResultColor = (result: string) => {
    switch (result) {
      case 'allowed':
        return 'border-green-200 bg-green-50';
      case 'blocked':
        return 'border-red-200 bg-red-50';
      case 'requires_approval':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'allowed':
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Allowed
          </Badge>
        );
      case 'blocked':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Blocked
          </Badge>
        );
      case 'requires_approval':
        return (
          <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Approval Required
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <AccordionItem
      value={`entry-${entry.timestamp}`}
      className={`rounded-lg border ${getResultColor(entry.result)}`}
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-3">
            <code className="text-sm font-mono font-semibold text-gray-900">
              {entry.tool}
            </code>
            {getResultBadge(entry.result)}
          </div>
          <span className="text-xs text-gray-500">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3">
          {/* Arguments */}
          {entry.args && Object.keys(entry.args).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Arguments:</p>
              <div className="rounded bg-white border border-gray-200 p-2">
                <code className="text-xs font-mono text-gray-700">
                  {JSON.stringify(entry.args, null, 2)}
                </code>
              </div>
            </div>
          )}

          {/* Violation Details */}
          {entry.violation && (
            <div className="rounded bg-red-100 border border-red-300 p-3">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-red-700" />
                <p className="text-xs font-semibold text-red-900">Violation Detected</p>
                <Badge className="bg-red-200 text-red-900 text-xs">
                  {entry.violation.severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-red-800 mb-1">
                <span className="font-medium">Type:</span> {entry.violation.type}
              </p>
              <p className="text-xs text-red-800">
                <span className="font-medium">Message:</span> {entry.violation.message}
              </p>
            </div>
          )}

          {/* Metadata */}
          {entry.metadata && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Metadata:</p>
              <div className="rounded bg-white border border-gray-200 p-2">
                <code className="text-xs font-mono text-gray-700">
                  {JSON.stringify(entry.metadata, null, 2)}
                </code>
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Compact Guardrails Status Badge
 */
export function GuardrailsStatusBadge() {
  const [stats, setStats] = React.useState(globalGuardrails.getStats());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(globalGuardrails.getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const successRate =
    stats.totalRequests > 0 ? (stats.allowed / stats.totalRequests) * 100 : 100;

  const statusColor = successRate >= 90 ? 'bg-green-500' : successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <Badge variant="outline" className="gap-1.5">
      <div className={`h-2 w-2 rounded-full ${statusColor}`} />
      <Shield className="h-3 w-3" />
      <span className="text-xs">
        {stats.blocked > 0 && `${stats.blocked} blocked`}
        {stats.blocked === 0 && 'Protected'}
      </span>
    </Badge>
  );
}
