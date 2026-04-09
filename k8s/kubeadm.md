##  Setup Kubernetes [Kubeadm] Cluster (Version: 1.33)

### On both master & worker nodes
- <i>  Become root user </i>
```bash
sudo su
```

- <i>  Updating System Packages </i>
```bash
sudo apt-get update
```

- <i> Installing Docker </i>
```bash
sudo apt install docker.io -y
```
```bash
sudo chmod 777 /var/run/docker.sock
```

- <i> Create a shell script 1.sh and paste the below code and run it :
```bash
#!/bin/bash

# Disable swap (temporary + permanent)
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# Kernel modules
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# Sysctl
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables=1
net.bridge.bridge-nf-call-ip6tables=1
net.ipv4.ip_forward=1
EOF

sudo sysctl --system

# 🔥 FIX: remove containerd
sudo apt-get remove -y containerd

# Dependencies
sudo apt-get update -y
sudo apt-get install -y software-properties-common curl apt-transport-https ca-certificates gpg

# 🔥 FIX: ensure keyring dir exists
sudo mkdir -p /etc/apt/keyrings

# 🔥 FIX: use stable CRI-O repo matching k8s version
sudo curl -fsSL https://pkgs.k8s.io/addons:/cri-o:/stable:/v1.33/deb/Release.key \
 | sudo gpg --dearmor -o /etc/apt/keyrings/cri-o-apt-keyring.gpg

echo "deb [signed-by=/etc/apt/keyrings/cri-o-apt-keyring.gpg] https://pkgs.k8s.io/addons:/cri-o:/stable:/v1.33/deb/ /" \
 | sudo tee /etc/apt/sources.list.d/cri-o.list

sudo apt-get update -y
sudo apt-get install -y cri-o

sudo systemctl enable --now crio

echo "CRI runtime installed successfully"

# Kubernetes repo
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.33/deb/Release.key \
 | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.33/deb/ /' \
 | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update -y

# Install k8s
sudo apt-get install -y kubelet="1.33.0-*" kubeadm="1.33.0-*" kubectl="1.33.0-*" jq

# 🔥 FIX: prevent upgrades
sudo apt-mark hold kubelet kubeadm kubectl

sudo systemctl enable --now kubelet

### On Master node
- <i> Create a shell script 2.sh and paste the below code and run it </i>
```bash
sudo kubeadm config images pull

sudo kubeadm init

mkdir -p "$HOME"/.kube
sudo cp -i /etc/kubernetes/admin.conf "$HOME"/.kube/config
sudo chown "$(id -u)":"$(id -g)" "$HOME"/.kube/config


# Network Plugin = calico
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.31.4/manifests/custom-resources-bpf.yaml


kubeadm token create --print-join-command
```

### On Worker node
- <i> Paste the join command you got from the master node and append --v=5 at the end </i>

```bash
<join-command> --v=5
```