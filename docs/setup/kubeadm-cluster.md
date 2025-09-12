
---

# 📄 `docs/setup/networking.md`

```md
# Networking Setup

This document covers node-level networking for the homelab.

---

## Node Connectivity

- All nodes are connected via wired Ethernet
- Nodes are placed on the same subnet
- Static IPs or DHCP reservations are required

Example:

| Node | IP |
|----|----|
| k8s-cp-1 | 192.168.1.10 |
| k8s-w-1 | 192.168.1.11 |

---

## /etc/hosts Configuration

Each node must be able to resolve others by hostname.

```bash
192.168.1.10 k8s-cp-1
192.168.1.11 k8s-w-1
