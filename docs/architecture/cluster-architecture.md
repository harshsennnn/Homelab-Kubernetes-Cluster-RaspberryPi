# Cluster Architecture

## Overview

This Kubernetes homelab is a **bare-metal, on-prem cluster** built using Raspberry Pi hardware.  
The architecture is intentionally minimal while preserving production-like characteristics such as separation of control plane and worker responsibilities, network isolation, and operational observability.

The cluster is designed to:
- Run on constrained hardware
- Simulate real Kubernetes operations
- Support application deployment, monitoring, and failure recovery
- Avoid reliance on cloud-managed services

---

## Physical Topology

| Node | Role | RAM | Storage |
|-----|------|-----|---------|
| k8s-cp-1 | Control Plane | 4 GB | 128 GB |
| k8s-w-1 | Worker | 4 GB | 128 GB |

All nodes are connected via a **local gigabit Ethernet LAN** and operate within the same subnet.

---

## Node Responsibilities

### Control Plane Node (`k8s-cp-1`)
Runs Kubernetes control plane components:
- `kube-apiserver`
- `kube-scheduler`
- `kube-controller-manager`
- `etcd`

Responsibilities:
- Cluster state management
- Scheduling workloads
- Exposing Kubernetes API

This node is tainted to prevent regular workloads from running on it by default.

---

### Worker Node (`k8s-w-1`)
Runs application workloads and system services:
- Application Pods
- Ingress Controller
- Monitoring components

Responsibilities:
- Execute scheduled workloads
- Handle ingress traffic
- Report node and pod metrics

---

## Software Stack

| Layer | Technology |
|-----|------------|
| OS | Ubuntu Server 22.04 LTS (ARM64) |
| Container Runtime | containerd |
| Kubernetes Bootstrap | kubeadm |
| CNI | Calico |
| Ingress | NGINX Ingress Controller |
| Load Balancing | MetalLB |
| Monitoring | Prometheus, Grafana |

---

## Cluster Bootstrap Flow

1. Operating system installed on each node
2. Kernel modules and sysctl configured for Kubernetes
3. containerd installed and configured
4. Kubernetes initialized using kubeadm on control plane
5. Worker node joined using kubeadm join
6. CNI installed to enable pod networking
7. Core system add-ons deployed (Ingress, LoadBalancer)

---

## Design Considerations

- **Minimal node count** chosen for resource efficiency
- **Bare-metal networking** handled explicitly without cloud abstractions
- **Stateless workloads** preferred to simplify recovery
- **Observability-first design** to understand system behavior

---

## Limitations

- Single control plane node (no HA)
- No cloud-managed load balancer
- Limited resources compared to production clusters

These limitations are intentional and reflect realistic homelab constraints.

---

## Future Enhancements

- Add additional worker nodes
- Introduce control plane high availability
- Persistent storage via NFS or CSI drivers
- Advanced security policies (PodSecurity, NetworkPolicy)
