# Yureka SOPs

Operational playbooks for Yureka One. Hosts:

| Host | Purpose |
|------|---------|
| [yureka.one](https://yureka.one) | Marketing / landing |
| [app.yureka.one](https://app.yureka.one) | Waitlist, login, member dashboard |
| [admin.yureka.one](https://admin.yureka.one) | Backoffice |
| [brand.yureka.one](https://brand.yureka.one) | Partner brand portal |

| SOP pack | Audience | File |
|----------|----------|------|
| [User-end](./01-user-end.md) | Members & waitlist applicants | How to use the product |
| [Support](./02-support.md) | CS / success | Triage, lookups, scripts |
| [Admin](./03-admin.md) | Backoffice operators | Approve, push, goldback, CMS |
| [Integrations](./04-integrations.md) | Eng / ops | Gmail, payments, email, vendors |
| [Management](./05-management.md) | Leads / founders | Escalation, access, incidents |
| [Core team](./06-core-team.md) | Eng / deploy | Ship, secrets, security baselines |

**Rules of engagement**
- Never share another member’s PII (email, phone, spend, score) outside approved channels.
- Admin actions require `admin.yureka.one` session — do not use production DB as a shortcut unless Core Team.
- Prefer Resend / `support@yureka.one` for outbound member email.
