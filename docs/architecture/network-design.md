# Network Design

## Overview
  
Since the cluster runs on **bare-metal hardware**, all networking components must be explicitly configured without cloud provider abstractions.

---

## Physical Network

- All nodes are connected via **Gigabit Ethernet**
- Nodes reside in the same Layer-2 LAN
- IP addresses are assigned using **DHCP reservations** or static configuration

Example IP allocation:

| Node | IP Address |
|----|------------|
| k8s-cp-1 | 192.168.1.10 |
| k8s-w-1 | 192.168.1.11 |

---

## Kubernetes Networking Layers

### 1. Node Network
- Managed by the underlying Linux OS
- Provides connectivity between physical nodes
- Used by Kubernetes control plane communication

---

### 2. Pod Network (CNI)

- Implemented using **Calico**
- Each pod receives a unique IP address
- Pod-to-pod communication is routable across nodes
- No NAT between pods

Key benefits:
- Predictable pod networking
- Support for future NetworkPolicies

---

### 3. Service Network

- Kubernetes `ClusterIP` services expose pods internally
- kube-proxy handles service routing
- Services are not externally accessible by default

---

## External Traffic Flow

Since this is a bare-metal cluster, external access is handled manually.

### Traffic Flow

Client
↓
LAN IP (MetalLB)
↓
NGINX Ingress Controller
↓
Kubernetes Service
↓
Application Pod


---

## Load Balancing (MetalLB)

MetalLB provides **LoadBalancer functionality** for bare-metal clusters.

- Operates in Layer-2 (ARP) mode
- Advertises service IPs on the local network
- Integrates natively with Kubernetes Services

This allows Kubernetes services to receive real LAN IPs.

---

## Ingress

- NGINX Ingress Controller runs as a Kubernetes Deployment
- Routes HTTP/HTTPS traffic based on host and path rules
- Central entry point for external access

Ingress allows:
- Path-based routing
- Centralized TLS termination (future)
- Simplified service exposure

---

## Security Considerations

- No services exposed directly via NodePort
- External traffic enters only through Ingress
- Control plane endpoints are not publicly exposed
- Firewall rules restrict unnecessary traffic

---

## Known Constraints

- No cloud-managed load balancers
- No public DNS integration
- Single network segment (no VLANs)

---

## Future Improvements

- Enable NetworkPolicies for pod isolation
- Add TLS with cert-manager
- Introduce separate management and workload networks
- Implement logging for ingress traffic
