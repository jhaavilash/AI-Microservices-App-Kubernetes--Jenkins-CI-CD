#!/bin/bash
# ==============================
# K8s 1.33 Setup Script (Master & Worker)
# Removes containerd, installs Docker + CRI-O
# ==============================

set -e

echo "Starting Kubernetes 1.33 setup..."

# 1️⃣ Become root (if not already)
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root"
    exit
fi

# 2️⃣ Update system packages
apt-get update -y

# 3️⃣ Install Docker
apt-get install -y docker.io
chmod 777 /var/run/docker.sock

# 4️⃣ Disable swap
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab

# 5️⃣ Load kernel modules
cat <<EOF > /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

# 6️⃣ Sysctl settings
cat <<EOF > /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables=1
net.bridge.bridge-nf-call-ip6tables=1
net.ipv4.ip_forward=1
EOF

sysctl --system

# 7️⃣ Remove containerd completely
apt-get remove -y containerd
apt-get purge -y containerd
rm -rf /var/lib/containerd

# 8️⃣ Install dependencies
apt-get install -y software-properties-common curl apt-transport-https ca-certificates gpg

mkdir -p /etc/apt/keyrings

# 9️⃣ Install CRI-O repo (v1.33)
curl -fsSL https://pkgs.k8s.io/addons:/cri-o:/stable:/v1.33/deb/Release.key \
  | gpg --dearmor -o /etc/apt/keyrings/cri-o-apt-keyring.gpg

echo "deb [signed-by=/etc/apt/keyrings/cri-o-apt-keyring.gpg] https://pkgs.k8s.io/addons:/cri-o:/stable:/v1.33/deb/ /" \
  > /etc/apt/sources.list.d/cri-o.list

apt-get update -y
apt-get install -y cri-o
systemctl enable --now crio

# 10️⃣ Kubernetes repo
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.33/deb/Release.key \
  | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.33/deb/ /' \
  > /etc/apt/sources.list.d/kubernetes.list

apt-get update -y

# 11️⃣ Install kubeadm, kubelet, kubectl
apt-get install -y kubelet="1.33.0-*" kubeadm="1.33.0-*" kubectl="1.33.0-*" jq
apt-mark hold kubelet kubeadm kubectl
systemctl enable --now kubelet

# 12️⃣ Master Node Initialization
read -p "Is this the Master Node? (yes/no): " IS_MASTER

if [[ "$IS_MASTER" == "yes" ]]; then
    echo "Initializing Kubernetes master node..."
    
    kubeadm config images pull
    kubeadm init
    
    mkdir -p $HOME/.kube
    cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
    chown $(id -u):$(id -g) $HOME/.kube/config

    echo "Deploying Calico network plugin..."
    kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.31.4/manifests/custom-resources-bpf.yaml
    
    echo "Master node setup complete."
    echo "Copy this join command for worker nodes:"
    kubeadm token create --print-join-command

else
    echo "Worker node setup complete. Use the join command from master to join this node."
fi

echo "✅ Kubernetes setup finished."