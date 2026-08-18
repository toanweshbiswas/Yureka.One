# Fix SSH: Permission denied (publickey)

Your `yureka.pem` is a **valid** RSA key, but instance `i-0fc71adcbbce91e3e` was **not launched with this key pair** (or a different `.pem` was downloaded at launch).

Port 22 works — only authentication fails.

---

## Step 1 — Confirm in AWS Console

1. **EC2 → Instances → `i-0fc71adcbbce91e3e`**
2. **Details** tab → **Key pair name** (e.g. `yureka`, `my-key`, etc.)
3. You must use the **`.pem` downloaded when that key pair was created**.

If you don’t have that file, use **Step 2** (Instance Connect) — you cannot recover the original private key.

Print the public key from your local `yureka.pem`:

```bash
chmod 400 yureka.pem
./scripts/ec2/print-public-key.sh
```

In **EC2 → Key pairs**, open the key pair attached to the instance and compare fingerprints (optional).

---

## Step 2 — Get in via EC2 Instance Connect (no PEM needed)

1. **EC2 → Instances → select instance → Connect**
2. Tab **EC2 Instance Connect** → User name:
   - **`ec2-user`** for Amazon Linux (current Yureka instance)
   - **`ubuntu`** only if you launch an Ubuntu AMI later
3. **Connect** (browser terminal opens)

Note which username worked — use that for SSH later.

---

## Step 3 — Install your `yureka.pem` public key on the server

**On your Mac**, copy one line:

```bash
ssh-keygen -y -f yureka.pem
```

**In the Instance Connect terminal** (as `ec2-user` on the current instance):

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# Paste the single line starting with ssh-rsa ..., save (Ctrl+O, Enter, Ctrl+X)
chmod 600 ~/.ssh/authorized_keys
```

Or one command (replace `PASTE_SSH_RSA_LINE_HERE`):

```bash
echo 'PASTE_SSH_RSA_LINE_HERE' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## Step 4 — Test SSH from Mac

```bash
chmod 400 yureka.pem
ssh -i yureka.pem ec2-user@13.57.223.228
```

---

## Step 5 — Open HTTP (site currently times out)

**EC2 → Security groups → Inbound rules → Edit**

| Type | Port | Source |
|------|------|--------|
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |
| SSH | 22 | Your IP |

---

## Step 6 — Bootstrap Yureka (after SSH works)

```bash
sudo git clone https://github.com/Sakshikhade/Yureka.One.git /opt/yureka-one
sudo chown -R $USER:$USER /opt/yureka-one
cd /opt/yureka-one
cp .env.example .env
nano .env   # paste production secrets; set APP_ORIGIN=https://13-57-223-228.sslip.io
bash scripts/ec2/bootstrap.sh
curl -s http://127.0.0.1/api/health
```

Or from Mac (once SSH works):

```bash
scp -i yureka.pem .env ec2-user@13.57.223.228:/opt/yureka-one/.env
EC2_HOST=13.57.223.228 EC2_KEY=./yureka.pem ./scripts/ec2/deploy-from-local.sh
```

---

## Alternative — launch a new instance (cleanest)

If Instance Connect is unavailable:

1. **EC2 → Key pairs → Create** → name `yureka` → download **new** `.pem` (only once).
2. Launch Ubuntu 22.04 with that key pair + same security group rules.
3. Attach **Elastic IP**.
4. Replace `yureka.pem` with the new file and SSH works immediately.

See also [`EC2_DEPLOY.md`](./EC2_DEPLOY.md).
