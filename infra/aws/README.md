# Hearthly on AWS — Terraform skeleton

This directory contains a working **starter** Terraform stack for deploying
Hearthly to AWS in the `ap-south-1` (Mumbai) region. It is intentionally
minimal — enough to stand up a working environment, not so much that you
have to fight it before going to prod.

## What you get

```
infra/aws/
├── README.md            (this file)
├── versions.tf          provider + backend pins
├── variables.tf         all knobs in one place
├── network.tf           VPC, subnets, IGW, NAT, security groups
├── ecr.tf               two private ECR repos (web, cmcc)
├── ecs.tf               Fargate cluster + services for web and cmcc
├── alb.tf               public ALB, listeners, target groups
├── rds.tf               Postgres 16 (db.t4g.medium, single-AZ for staging)
├── secrets.tf           Secrets Manager entries for JWT_SECRET, OPENAI_API_KEY, SUPABASE_*
├── route53.tf           OPTIONAL — only used if `var.domain_zone_id` is set
└── outputs.tf           ALB DNS, RDS endpoint, etc.
```

## Quick start

```sh
cd infra/aws
cp terraform.tfvars.example terraform.tfvars  # fill in
terraform init
terraform plan
terraform apply
```

Push images:

```sh
aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin <account>.dkr.ecr.ap-south-1.amazonaws.com
docker build -t hearthly/web:latest -f ../../Dockerfile ../..
docker tag  hearthly/web:latest  <account>.dkr.ecr.ap-south-1.amazonaws.com/hearthly-web:latest
docker push <account>.dkr.ecr.ap-south-1.amazonaws.com/hearthly-web:latest
# repeat for cmcc
aws ecs update-service --cluster hearthly --service web --force-new-deployment
```

(or use the GitHub Actions workflow at `.github/workflows/aws-deploy.yml` —
manual-trigger only, won't conflict with Vercel auto-deploys.)

## Architecture

```
                 ┌──────────────────────────────────────────────┐
                 │                CloudFront (TLS)              │
                 │     (optional — see route53.tf to enable)    │
                 └────────────────────┬─────────────────────────┘
                                      │
                              ┌───────▼────────┐
                              │  Public ALB    │
                              │  :443 / :80    │
                              └───┬───────┬────┘
                                  │       │
                  ┌───────────────┘       └───────────────┐
                  ▼                                       ▼
          ┌──────────────┐                        ┌──────────────┐
          │ ECS Fargate  │                        │ ECS Fargate  │
          │   web:3030   │                        │  cmcc:4040   │
          └──────┬───────┘                        └──────┬───────┘
                 │                                       │
                 ▼                                       ▼
          ┌──────────────────────────────────────────────────────┐
          │            RDS Postgres 16 (ap-south-1)              │
          └──────────────────────────────────────────────────────┘

         + NLB :1883  →  web (MQTT, broker mode)   [optional]
         + Secrets Manager: JWT_SECRET, OPENAI_API_KEY, SUPABASE_*
         + CloudWatch Logs: /ecs/hearthly/{web,cmcc}
```

## Cost shape (rough — staging)

| Component | Monthly (USD, ap-south-1) |
|---|---|
| 2× Fargate tasks (0.5 vCPU / 1 GB, 730h) | ~$40 |
| ALB | ~$22 |
| RDS db.t4g.medium single-AZ | ~$60 |
| NAT Gateway (1) | ~$32 |
| ECR storage + transfer | <$5 |
| CloudWatch logs (modest) | <$5 |
| **~$165 / month** | |

For prod-grade HA, switch RDS to Multi-AZ, ALB across 2 AZs, Fargate
desired-count=2 across AZs. Roughly doubles the bill.

## What's intentionally NOT here

- **CDN (CloudFront)** — adding when traffic justifies it; ALB is fine for
  initial pilots
- **WAF** — enable per-tender requirement
- **Auto-scaling policies** — Fargate target-tracking on CPU is a 5-line add
  once we have steady-state traffic
- **MeghRaj / NIC sovereign-cloud** — same Terraform shape, different
  provider blocks; out of scope for this skeleton

See `docs/DEPLOY_AWS.md` for the operator runbook.
