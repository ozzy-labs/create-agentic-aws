# CD Setup Guide

This project includes CI (lint, typecheck, test, build) but not CD.
Set up CD based on your deployment target and environment.

## GitHub Actions CD

Add a deployment workflow in `.github/workflows/cd.yaml` with appropriate
environment secrets and approval gates.
