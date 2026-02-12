# Migration Plan for Production (On-Chain Stable Wallet)

## 1. Key management

- **Operator / backend signer:** Do not store `OPERATOR_PRIVATE_KEY` or `BACKEND_SIGNER_PRIVATE_KEY` in plain `.env` in production. Prefer:
  - AWS KMS / GCP Cloud KMS: decrypt or sign in app using key ID.
  - HashiCorp Vault: read secret at runtime.
  - At minimum: inject key via environment (e.g. CI/CD secret) and restrict file permissions.
- **DEFAULT_ADMIN_ROLE:** Assign to a multisig (e.g. Gnosis Safe). Use a timelock for sensitive admin actions (set router, rescueToken, set fees).
- **MINTER_ROLE:** Restrict to backend operator or a dedicated minting key; revoke from deployer EOA if not needed.

## 2. Multisig and timelock

- Deploy or use an existing multisig for contract owner/admin.
- Grant `DEFAULT_ADMIN_ROLE` to the multisig and revoke from EOA.
- For upgrades or critical config, use a timelock contract so changes are delay-executed and visible before taking effect.

## 3. Gas and funding

- Keep the operator wallet funded with native token (ETH/MATIC) for gas (withdraw, swap, mint).
- Set low-balance alerts and top-up process.
- Consider gas estimation before sending and circuit-breaker if gas price exceeds a threshold.

## 4. Monitoring and SLAs

- **Watcher:** Log reconnects and failed processing; alert on repeated errors or backlog (e.g. blocks behind). SLA: process deposits within N blocks of confirmation.
- **Failed tx:** Notify on revert or timeout (e.g. Slack/PagerDuty). Store failed intent in DB for manual retry or support.
- **Payments:** Alert when a deposit is seen on-chain but DB credit fails (idempotency by txHash should prevent double-credit; alert for “event seen but wallet not found” or DB errors).
- **Rate limits:** Enforce on withdrawal and swap endpoints; consider daily/user limits and KYC/OTP for large amounts.

## 5. Withdrawal and KYC

- Implement withdrawal thresholds and optional KYC/OTP for large withdrawals.
- Log all withdraw/send and swap in audit log with operator id and params.
- Optional: second approval or delay for large operator withdrawals.

## 6. Checklist before mainnet

- [ ] Operator key in KMS/HSM or secure env vault.
- [ ] DEFAULT_ADMIN_ROLE moved to multisig + timelock.
- [ ] Operator wallet funded for gas; alerts configured.
- [ ] Watcher and deposit processor monitored; reconnect and error handling tested.
- [ ] Rate limiting and withdrawal thresholds enabled.
- [ ] Audit logging and alerting on failed tx and payment anomalies.
