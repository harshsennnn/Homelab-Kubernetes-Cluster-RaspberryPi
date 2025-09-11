# Hardware Requirements

This document outlines the hardware requirements for running the Kubernetes homelab on Raspberry Pi devices.

---

## Minimum Cluster Configuration

| Component | Specification |
|--------|----------------|
| Nodes | 2 × Raspberry Pi |
| RAM | 4 GB per node |
| Storage | 128 GB per node |
| CPU | ARM64 |
| Network | Gigabit Ethernet |

### Node Roles
- 1 Control Plane Node
- 1 Worker Node

This configuration is sufficient for running:
- Kubernetes control plane
- Ingress controller
- Monitoring stack (Prometheus, Grafana)
- Sample workloads

---

## Recommended Accessories

- USB SSD (preferred over microSD for durability)
- Gigabit Ethernet switch
- Reliable power supply for each Pi
- Cooling (heat sinks / fan)

---

## Constraints & Considerations

- Limited CPU and memory compared to cloud VMs
- Single control plane (no HA)
- Resource-heavy workloads must be avoided

These constraints are intentional to simulate real-world operational tradeoffs.
