# Release and branch policy

User decision — 28 October 2026:

- Stable versions are S2A Pilot 1.5.8 and S2A Pilot Bridge 1.4.5.
- Copilot and QR Code development is resumed as beta work.
- All Copilot/QR Code changes must be committed and pushed only on a beta branch. The initial branch is `beta/copilot-qr`.
- Never push beta work to `main`, merge it into `main`, or replace stable release downloads with beta builds without new explicit user authorization.
- Before modifying files or pushing, verify the current branch. If on `main`, switch to an appropriate beta branch first.
- Clearly label beta artifacts and keep them separate from the stable Pilot/Bridge releases.
- Authorization to push beta work does not authorize production deployment or promotion to stable.
