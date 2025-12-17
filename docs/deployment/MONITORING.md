# Orchestrator Monitoring

The Jules Orchestrator exposes Prometheus-compatible metrics to track system health and agent performance.

## Metrics Endpoint

**URL:** `https://scarmonit.com/api/v1/metrics`

This endpoint returns plain text metrics including:
- `workflow_total`: Counter of started/completed/failed workflows
- `workflow_duration_seconds`: Histogram of execution times
- `jules_tasks_total`: Count of tasks delegated to Jules API
- `active_workflows`: Gauge of currently running processes

## Local Monitoring Stack

To view a graphical dashboard of these metrics, you can spin up the pre-configured monitoring stack locally.

### Prerequisites
- Docker & Docker Compose

### Setup
1. Navigate to the monitoring directory:
   ```bash
   cd orchestrator-api/monitoring
   ```

2. Update `prometheus.yml` targets if necessary (default points to the live Render URL).

3. Start the stack:
   ```bash
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

4. Access Dashboards:
   - **Grafana:** `http://localhost:3001` (admin/admin)
   - **Prometheus:** `http://localhost:9090`

## Grafana Configuration

A custom dashboard is available for import in Grafana.

1. Log in to Grafana.
2. Go to **Dashboards** > **New** > **Import**.
3. Paste the JSON content below or upload `grafana-dashboard.json` (if created).

### Key Alerts (Defined in `alerts.yml`)

- **High Failure Rate:** >10% of workflows failing in 5m.
- **Stuck Workflows:** Any workflow running > 1 hour.
- **API Downtime:** Orchestrator unreachable for > 2 minutes.
- **Resource Exhaustion:** Database or Redis limits approaching.
