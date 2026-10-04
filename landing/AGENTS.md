# AGENTS.md

## Project

This is a QRWin landing site built with Astro + Tailwind CSS.

## Image Generation

To generate images using the HydraAI API, refer to the skill at:

**[skills/images/SKILL.md](skills/images/SKILL.md)**

Quick reference:
- Endpoint: `POST https://api.hydraai.ru/v1/chat/completions`
- Model: `hydra-banana-pro`
- Auth: `Authorization: Bearer $HYDRA_API_KEY`
- Response: base64 image in `choices[0].message.content` as `![image](data:image/png;base64,...)`
- Cost: ~2.5 RUB/request, ~15–35s generation time

When asked to generate an image, read `skills/images/SKILL.md` for full instructions, prompt tips, and extraction code.

## Deployment

When deploying, follow the instructions in **[deploy.md](deploy.md)** — it contains the S3 bucket credentials and configuration for deployment.

## Commands

Run linting and type checks before committing:
```bash
# Add project-specific commands here as needed
```
