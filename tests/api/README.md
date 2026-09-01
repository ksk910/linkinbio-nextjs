# API Integration Test Scaffold

This folder is the Sprint 0 baseline for PH1-QA-01.

## Goal

- Define stable conventions for API integration tests before adding full coverage.
- Keep the test command green while we incrementally implement real scenarios.

## Run

```bash
npm run test:api
```

## Planned test targets

- auth: signup / login / logout
- profile: update / change-password / link / reorder / check-slug
- upload: avatar

## Notes

- Initial tests are intentionally `skip` placeholders.
- Each implemented API ticket should replace at least one `skip` with executable test cases.
