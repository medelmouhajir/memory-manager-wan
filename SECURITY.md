# Security policy

## Supported versions

Security updates are applied to the default branch (`main` or `master`) as issues are confirmed and fixed. This repository does not publish numbered release branches; deploy from a maintained commit or your own fork with your patch policy.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for undisclosed security problems.

Instead:

1. Open a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) for this repository if the feature is enabled, **or**
2. Contact the maintainers through a private channel they have published for this project (for example organization security contact or maintainer email).

Include enough detail to reproduce the issue (version or commit, configuration, and impact) without including secrets or live production data.

## Scope

In scope: the Session Vault backend, frontend, and documented deployment defaults (for example Docker Compose and environment variables) shipped in this repository.

Out of scope: vulnerabilities in your deployment platform, third-party dependencies (report those to the upstream project), or misconfiguration outside this repository’s documented recommendations.
