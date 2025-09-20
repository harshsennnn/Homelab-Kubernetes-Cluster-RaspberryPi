#!/usr/bin/env bash
set -e

echo "🚀 Deploying full microservices platform to Kubernetes..."

echo "📦 Applying namespaces..."
kubectl apply -f kubernetes/namespaces/

echo "🌐 Applying networking components..."
kubectl apply -f kubernetes/networking/

echo "🧱 Applying platform components..."
kubectl apply -f kubernetes/platform/

echo "📊 Applying monitoring stack..."
kubectl apply -f kubernetes/monitoring/

echo "🧩 Deploying microservices..."
kubectl apply -f kubernetes/microservices/

echo "✅ Deployment completed successfully"
