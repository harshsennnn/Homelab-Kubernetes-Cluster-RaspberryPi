# Kubernetes Homelab on Raspberry Pi (Bare-Metal)

This repository documents the design, setup, and operation of a **bare-metal Kubernetes homelab** built from scratch using **Raspberry Pi nodes**.  
The project focuses on **real-world Kubernetes operations**, on-prem networking challenges, and production-style workflows such as CI/CD, monitoring, and failure recovery.

The homelab is intentionally built without managed cloud services to gain deep hands-on experience with Kubernetes internals, Linux administration, and cluster reliability in a constrained hardware environment.

---

## 🧩 Hardware Configuration

| Component | Specification |
|---------|---------------|
| Nodes | 2 × Raspberry Pi |
| RAM | 4 GB per node |
| Storage | 128 GB per node |
| Architecture | ARM64 |
| Networking | Gigabit Ethernet (LAN) |

### Node Roles
- **1 Control Plane Node**
- **1 Worker Node**

This topology mirrors a minimal but realistic production-style Kubernetes setup suitable for learning cluster operations and failure handling.

---

## 🎯 Project Goals

- Build a Kubernetes cluster **from scratch on bare metal**
- Understand node bootstrap, container runtime setup, and kubeadm internals
- Operate Kubernetes in an **on-prem / homelab environment**
- Implement ingress and load balancing without cloud providers
- Deploy containerized workloads using CI/CD pipelines
- Monitor cluster health and resource usage
- Practice SRE-style failure scenarios and recovery
- Maintain clear documentation and operational runbooks

---

## 🏗️ Architecture Overview

- **Operating System:** Ubuntu Server 22.04 LTS (ARM64)
- **Container Runtime:** containerd
- **Kubernetes Distribution:** kubeadm
- **Networking (CNI):** Calico (or Flannel)
- **Ingress Controller:** NGINX Ingress
- **LoadBalancer (Bare Metal):** MetalLB
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus & Grafana

The cluster is deployed entirely on local hardware, exposing services via LAN IPs and ingress routing.

---

## 📂 Repository Structure



k8s-homelab/
├── README.md
├── docs/ # Architecture, setup guides, runbooks
├── infrastructure/ # OS bootstrap and node preparation
├── kubernetes/ # Cluster manifests (networking, apps, monitoring)
├── apps/ # Sample containerized workloads
├── ci-cd/ # GitHub Actions and deployment scripts
└── scripts/ # Ops, troubleshooting, and failure simulation scripts


---

## 🔧 What This Project Demonstrates

- Bare-metal Kubernetes cluster design and operation
- Linux system preparation for Kubernetes nodes
- On-prem networking challenges and solutions
- End-to-end application delivery to Kubernetes
- Monitoring and observability in resource-constrained environments
- Practical incident response and recovery workflows
- Documentation-first engineering approach

---

## 📈 Learning & Operational Focus

This project emphasizes **doing**, not just deploying:

- Node failures and recovery
- Pod crashes and restarts
- Resource pressure scenarios
- Cluster maintenance (cordon, drain, upgrades)
- Troubleshooting networking and storage issues

All learnings and resolutions are documented for reproducibility.

---

## 🚀 Status

🟢 **Active Development**  
This homelab is continuously evolved to explore deeper Kubernetes, DevOps, and SRE concepts.

---

## 📜 License

This project is open for learning and experimentation purposes.

