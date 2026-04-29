# Deploying Hearthly to AWS

This is the operator runbook for taking the same source that powers the
Vercel demo and standing it up on AWS — for sovereign-cloud requirements,
ITE&C / MeghRaj tenders, or scale beyond Vercel's free tier.

**Vercel auto-deploys are unaffected by anything in this document.** The
two paths run in parallel.

## Prerequisites

- AWS account with admin or equivalent in `ap-south-1`
- `aws` CLI v2, `terraform` ≥ 1.6, `docker` ≥ 24
- (Optional) Route53 hosted zone if you want a custom domain

## 1. One-time bootstrap

```sh
cd infra/aws
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — at minimum set `owner` and (optionally) the
# OpenAI / Supabase secrets you want to provision
terraform init
terraform plan
terraform apply
```

Outputs you'll need:

```sh
terraform output alb_dns          # public URL
terraform output ecr_web_url      # for docker push
terraform output ecr_cmcc_url     # for docker push
terraform output rds_endpoint     # private postgres endpoint
```

## 2. Build & push images

```sh
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1
aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com

# web (citizen / agent / admin SPA + Express + MQTT)
docker build -t hearthly-web -f Dockerfile .
docker tag  hearthly-web $(terraform -chdir=infra/aws output -raw ecr_web_url):latest
docker push $(terraform -chdir=infra/aws output -raw ecr_web_url):latest

# cmcc (operator console)
docker build -t hearthly-cmcc -f cmcc-website/Dockerfile cmcc-website
docker tag  hearthly-cmcc $(terraform -chdir=infra/aws output -raw ecr_cmcc_url):latest
docker push $(terraform -chdir=infra/aws output -raw ecr_cmcc_url):latest
```

## 3. Roll the ECS services

```sh
aws ecs update-service --cluster hearthly-staging --service web  --force-new-deployment
aws ecs update-service --cluster hearthly-staging --service cmcc --force-new-deployment
```

Wait for tasks to reach `RUNNING`, then hit the ALB DNS in a browser.

## 4. Smoke test

```sh
ALB=$(terraform -chdir=infra/aws output -raw alb_dns)
curl -fsS http://$ALB/api/health        # citizen / web
curl -fsS http://$ALB/cmcc/api/health   # operator console
```

## 5. Wire your domain (optional)

In `infra/aws/terraform.tfvars`:

```hcl
domain_zone_id = "Z0123456789ABCDEFGHIJ"
domain_name    = "hearthly.example.com"
```

Then `terraform apply`. The stack will provision an ACM cert, a
Route53 ALIAS, and a `:443` listener.

## 6. Day-2 deploys via GitHub Actions

`.github/workflows/aws-deploy.yml` is a **manual-trigger** workflow
(`workflow_dispatch`). It does not fire on git push — Vercel auto-deploys
keep their lane.

1. Settings → Secrets and variables → Actions, add:
   - `AWS_ROLE_ARN` — an IAM role for OIDC (see below)
   - `AWS_REGION`, `ECR_WEB_REPO`, `ECR_CMCC_REPO`, `ECS_CLUSTER`,
     `ECS_WEB_SERVICE`, `ECS_CMCC_SERVICE`
2. Actions → "AWS deploy (manual)" → Run workflow → pick `web`, `cmcc`,
   or `both`.

### IAM role for OIDC (one-time)

```hcl
# Add to infra/aws/iam-github-oidc.tf if you want this in Terraform
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github_actions" {
  name = "hearthly-github-actions"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.github.arn }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = { "token.actions.githubusercontent.com:sub" = "repo:praneethpaturu/Hearthly:*" }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_ecs" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
}
resource "aws_iam_role_policy_attachment" "github_actions_ecr" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}
```

## 7. Operational notes

- **Logs** — CloudWatch `/ecs/hearthly/web` and `/ecs/hearthly/cmcc`.
- **Metrics** — Container Insights enabled by default on the cluster.
- **DB migrations** — `supabase/migrations/0001_init.sql` is mounted
  into the local Postgres via docker-compose. For RDS, run via
  `psql "$(terraform output -raw rds_endpoint)"` from a bastion or
  via SSM Session Manager.
- **Rolling back** — `aws ecs update-service --task-definition <previous>`
  to pin the old task-def revision. ECS keeps the last 10 by default.
- **Secrets rotation** — Secrets Manager handles rotation; rolling the
  task picks up new values on next deploy.
- **Cost ceiling** — set a Budgets alert on the `Project=hearthly` tag.

## 8. Sovereign-cloud / MeghRaj path

If a tender requires Indian sovereign hosting, the same Terraform shape
ports cleanly because we use only:

- ECS / Fargate-equivalent (NIC offers a similar managed-container option)
- RDS / managed-Postgres-equivalent
- Object storage (S3-equivalent)
- Secrets Manager (Vault works)
- ALB / NLB (any L7 / L4 load balancer)

Plan on ~2 weeks of plumbing work (provider blocks, networking
specifics) plus whatever paperwork the empanelment requires. Track in
`docs/IP-SAFETY.md`.

## 9. What's deliberately NOT in here

- A CloudFront / WAF front (add when the demo gets real traffic).
- Auto-scaling policies (Fargate target-tracking on CPU is a 5-line add).
- Multi-region active-active (the citizen + operator workload doesn't
  justify the complexity at the current stage).
- Bedrock provider for AI (nice-to-have for sovereign deploys —
  documented in `THIRD_PARTY_LICENSES.md`).
