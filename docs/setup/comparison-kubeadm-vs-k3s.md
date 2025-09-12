
---

# 📄 `docs/setup/comparison-kubeadm-vs-k3s.md`

```md
# kubeadm vs K3s

This document compares kubeadm-based Kubernetes with K3s in the context of a Raspberry Pi homelab.

---

## Comparison Table

| Aspect | kubeadm | K3s |
|-----|-------|-----|
| Complexity | High | Low |
| Resource Usage | Higher | Lower |
| Production Parity | Very High | Medium |
| Learning Value | Excellent | Good |
| Setup Speed | Slower | Faster |

---

## Why kubeadm Is Primary

- Mirrors real production clusters
- Exposes Kubernetes internals
- Better interview relevance

---

## When to Use K3s

- Extremely constrained hardware
- Edge deployments
- Rapid experimentation

---

## Conclusion

kubeadm is the primary choice for this homelab.  
K3s is maintained as a secondary reference for comparison.
