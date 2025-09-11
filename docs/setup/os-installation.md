# Operating System Installation

This cluster runs on **Ubuntu Server 22.04 LTS (ARM64)**.

---

## OS Selection Rationale

Ubuntu Server was chosen due to:
- Official Kubernetes support
- Stable systemd integration
- Long-term security updates
- Strong container runtime compatibility

---

## Installation Steps

1. Flash Ubuntu Server 22.04 LTS (ARM64) to storage
2. Enable SSH during installation
3. Create a non-root user with sudo access
4. Boot each Raspberry Pi
5. Update system packages

```bash
sudo apt update && sudo apt upgrade -y
