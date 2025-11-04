// Cache Performance Monitor Component
// Displays real-time cache statistics and performance metrics

import React from 'react';
import { globalCache, type CacheStats } from '../../lib/universal-cache';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Progress } from './progress';
import {
  Activity,
  Database,
  TrendingUp,
  TrendingDown,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from './button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';

interface CacheMonitorProps {
  refreshInterval?: number; // in ms, default 5000
}

export function CacheMonitor({ refreshInterval = 5000 }: CacheMonitorProps) {
  const [stats, setStats] = React.useState(globalCache.getAggregateStats());
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Auto-refresh stats
  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(globalCache.getAggregateStats());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const refresh = () => {
    setIsRefreshing(true);
    setStats(globalCache.getAggregateStats());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all caches?')) {
      globalCache.clearAll();
      setStats(globalCache.getAggregateStats());
    }
  };

  const totalRequests = stats.totalHits + stats.totalMisses;
  const hitRateColor = stats.avgHitRate >= 0.8 ? 'text-green-600' : stats.avgHitRate >= 0.5 ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle>Cache Performance Monitor</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
        <CardDescription>
          Real-time monitoring of tool execution caching
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
            <p className="text-2xl font-bold text-blue-900">{totalRequests}</p>
            <p className="text-xs text-blue-600 mt-1">
              {stats.totalHits} hits, {stats.totalMisses} misses
            </p>
          </div>

          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Hit Rate</span>
            </div>
            <p className={`text-2xl font-bold ${hitRateColor}`}>
              {(stats.avgHitRate * 100).toFixed(1)}%
            </p>
            <Progress value={stats.avgHitRate * 100} className="h-1.5 mt-2" />
          </div>

          <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Cache Size</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">{stats.totalSize}</p>
            <p className="text-xs text-purple-600 mt-1">
              entries stored
            </p>
          </div>

          <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-700">Evictions</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">{stats.totalEvictions}</p>
            <p className="text-xs text-orange-600 mt-1">
              entries removed
            </p>
          </div>
        </div>

        {/* Per-Tool Breakdown */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Per-Tool Statistics ({Object.keys(stats.tools).length} tools)
          </h3>

          {Object.keys(stats.tools).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No cache data available yet
            </p>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {Object.entries(stats.tools)
                .sort(([, a], [, b]) => (b.hits + b.misses) - (a.hits + a.misses))
                .map(([toolName, toolStats]) => (
                  <ToolStatsItem
                    key={toolName}
                    toolName={toolName}
                    stats={toolStats}
                    onClear={() => {
                      globalCache.clearTool(toolName);
                      setStats(globalCache.getAggregateStats());
                    }}
                  />
                ))}
            </Accordion>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ToolStatsItemProps {
  toolName: string;
  stats: CacheStats;
  onClear: () => void;
}

function ToolStatsItem({ toolName, stats, onClear }: ToolStatsItemProps) {
  const totalRequests = stats.hits + stats.misses;
  const hitRateColor = stats.hitRate >= 0.8 ? 'bg-green-600' : stats.hitRate >= 0.5 ? 'bg-yellow-600' : 'bg-red-600';
  const utilizationPercent = stats.maxSize > 0 ? (stats.size / stats.maxSize) * 100 : 0;

  return (
    <AccordionItem
      value={toolName}
      className="rounded-lg border border-gray-200 bg-white"
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-3">
            <code className="text-sm font-mono font-semibold text-gray-900">
              {toolName}
            </code>
            <Badge variant="outline" className="text-xs">
              {totalRequests} requests
            </Badge>
            <div className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${hitRateColor}`} />
              <span className="text-xs text-gray-600">
                {(stats.hitRate * 100).toFixed(1)}% hit rate
              </span>
            </div>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3">
          {/* Hit Rate Progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Cache Hit Rate</span>
              <span className="text-xs font-semibold text-gray-900">
                {stats.hits} / {totalRequests}
              </span>
            </div>
            <Progress value={stats.hitRate * 100} className="h-2" />
          </div>

          {/* Cache Utilization */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Cache Utilization</span>
              <span className="text-xs font-semibold text-gray-900">
                {stats.size} / {stats.maxSize}
              </span>
            </div>
            <Progress value={utilizationPercent} className="h-2" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded bg-green-50 border border-green-200 p-2">
              <p className="text-xs font-medium text-green-700">Hits</p>
              <p className="text-lg font-bold text-green-900">{stats.hits}</p>
            </div>
            <div className="rounded bg-red-50 border border-red-200 p-2">
              <p className="text-xs font-medium text-red-700">Misses</p>
              <p className="text-lg font-bold text-red-900">{stats.misses}</p>
            </div>
            <div className="rounded bg-orange-50 border border-orange-200 p-2">
              <p className="text-xs font-medium text-orange-700">Evictions</p>
              <p className="text-lg font-bold text-orange-900">{stats.evictions}</p>
            </div>
          </div>

          {/* Cache Entries */}
          {stats.entries.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">
                Recent Entries ({stats.entries.length})
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {stats.entries.slice(0, 10).map((entry, index) => (
                  <div
                    key={index}
                    className="rounded bg-gray-50 border border-gray-200 p-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <code className="font-mono text-gray-700 truncate flex-1">
                        {entry.key}
                      </code>
                      <span className="text-gray-500 ml-2">
                        {entry.hits} hits
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-gray-500">
                      <span>Age: {(entry.age / 1000).toFixed(0)}s</span>
                      <span>TTL: {(entry.ttl / 1000).toFixed(0)}s</span>
                    </div>
                  </div>
                ))}
                {stats.entries.length > 10 && (
                  <p className="text-xs text-gray-500 text-center py-1">
                    ...and {stats.entries.length - 10} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Clear Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Clear cache for ${toolName}?`)) {
                onClear();
              }
            }}
            className="w-full mt-2"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear Cache for {toolName}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Compact Cache Badge Component
 */
export function CacheBadge() {
  const [stats, setStats] = React.useState(globalCache.getAggregateStats());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(globalCache.getAggregateStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const hitRateColor = stats.avgHitRate >= 0.8 ? 'bg-green-500' : stats.avgHitRate >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <Badge variant="outline" className="gap-1.5">
      <div className={`h-2 w-2 rounded-full ${hitRateColor}`} />
      <span className="text-xs">
        Cache: {(stats.avgHitRate * 100).toFixed(0)}%
      </span>
    </Badge>
  );
}
