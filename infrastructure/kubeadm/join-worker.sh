#!/usr/bin/env bash
set -e

# ============================================
# Kubernetes Worker Node Join Script
# ============================================

if [[ $EUID -ne 0 ]]; then
  echo "❌ Please run as root"
  exit 1
fi

echo "🔍 Verifying prerequisites..."

# Disable swap (required by kubelet)
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab

# Load required kernel modules
cat <<EOF >/etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

# Sysctl params required by Kubernetes
cat <<EOF >/etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables=1
net.ipv4.ip_forward=1
net.bridge.bridge-nf-call-ip6tables=1
EOF

sysctl --system

echo "✅ Node prerequisites configured"

echo ""
echo "➡️  Paste the kubeadm join command below:"
echo "   (Generated from control-plane node)"
echo ""

read -r JOIN_CMD

echo "🚀 Joining cluster..."
eval "$JOIN_CMD"

echo "✅ Worker node successfully joined the cluster"
