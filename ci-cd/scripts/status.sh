#!/usr/bin/env bash

echo "📊 Cluster Nodes:"
kubectl get nodes

echo ""
echo "📦 Platform Pods:"
kubectl get pods -n platform

echo ""
echo "🧩 Microservices Pods:"
kubectl get pods -n microservices-app

echo ""
echo "📊 Monitoring Pods:"
kubectl get pods -n monitoring
