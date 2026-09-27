// The bot image a deploy pulls when BOT_IMAGE is unset: the exact tag
// published by .github/workflows/publish-bot-image.yml from lite-template/
// (git tag bot-vX.Y.Z → image tag X.Y.Z). Bump it when a bot-v tag ships and
// keep control/.env.example in step. Never :latest. Dependency-free so the
// version readers can import it without pulling in the docker deployer.
export const DEFAULT_BOT_IMAGE = 'ghcr.io/zombico/mojulo-bot:0.5.2';
