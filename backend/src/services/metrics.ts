type MetricSample = {
  durationMs: number;
  status: number;
  timestamp: string;
};

export class MetricsRegistry {
  private readonly samplesByRoute = new Map<string, MetricSample[]>();
  private readonly alertThresholds = {
    readP95Ms: 150,
    writeP95Ms: 250,
    compactP95Ms: 5000
  };

  observe(route: string, status: number, durationMs: number): void {
    const bucket = this.samplesByRoute.get(route) ?? [];
    bucket.push({
      durationMs,
      status,
      timestamp: new Date().toISOString()
    });
    if (bucket.length > 500) {
      bucket.shift();
    }
    this.samplesByRoute.set(route, bucket);
  }

  snapshot(): Record<string, unknown> {
    const routes: Record<string, unknown> = {};
    const alerts: Array<Record<string, unknown>> = [];
    for (const [route, samples] of this.samplesByRoute.entries()) {
      const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
      const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
      const total = durations.reduce((acc, value) => acc + value, 0);
      const p95 = durations.length > 0 ? Number(durations[p95Index]!.toFixed(2)) : 0;
      const statusCounts = samples.reduce<Record<string, number>>((acc, sample) => {
        const key = String(sample.status);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
      routes[route] = {
        count: samples.length,
        avg_ms: durations.length > 0 ? Number((total / durations.length).toFixed(2)) : 0,
        p95_ms: p95,
        max_ms: durations.length > 0 ? Number(durations[durations.length - 1]!.toFixed(2)) : 0,
        status_counts: statusCounts
      };
      const threshold = this.resolveThreshold(route);
      if (threshold !== null && p95 > threshold) {
        alerts.push({
          level: "warn",
          route,
          metric: "p95_ms",
          threshold,
          observed: p95
        });
      }
    }
    return {
      generated_at: new Date().toISOString(),
      routes,
      alerts
    };
  }

  private resolveThreshold(route: string): number | null {
    if (route.endsWith("/compact")) {
      return this.alertThresholds.compactP95Ms;
    }
    if (route.startsWith("GET ")) {
      return this.alertThresholds.readP95Ms;
    }
    if (route.startsWith("POST ") || route.startsWith("PUT ") || route.startsWith("PATCH ")) {
      return this.alertThresholds.writeP95Ms;
    }
    return null;
  }
}
