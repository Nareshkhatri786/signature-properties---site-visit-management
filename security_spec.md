# Security Specification - Signature Properties Site Visit Management

## 1. Data Invariants

- **Lead Integrity**: A lead cannot exist without a `name` (3-100 chars), a `mobile` (exactly 10 digits), and a `projectId`.
- **Relational Ownership**: Visits and Remarks must always be associated with a valid `projectId`.
- **Identity Bridge**: The `sessions` collection is the master source of truth for the relationship between a Firebase `auth.uid` and the application's internal `role` and `projectId`.
- **Temporal Strictness**: All `created_at` and `updated_at` fields must be server-validated timestamps (`request.time`).
- **Immutable Traceability**: Once an `activity` or `call_log` is created, it cannot be modified or deleted by non-admins.

## 2. The "Dirty Dozen" Payloads (Target: Access & Integrity Violation)

### Identity & Authentication
1. **Unauthenticated Write**: Attempting to create a lead without any `request.auth`.
2. **Anonymous Admin Escalation**: Attempting to set `role: 'admin'` in a `sessions` document for an anonymous account without being an admin.
3. **Session Hijacking**: User A attempting to update User B's `sessions` document.

### Schema & Poisoning
4. **Shadow Field Injection**: Creating a lead with an extra field `is_verified: true` to bypass business logic.
5. **ID Poisoning**: Attempting to create a lead with a 2MB string as the document ID.
6. **Type Mismatch**: Sending a number into the `mobile` field (which must be a string).

### Relational & State
7. **Orphaned Visit**: Creating a visit for a `projectId` that the user does not belong to.
8. **State Shortcut**: Updating a lead status directly to 'closed' without a 'visit_done' activity.
9. **Outcome Poisoning**: Updating a `call_log` with an invalid `outcome` like `scam`.

### Denial of Wallet & PII
10. **Array Explosion**: Attempting to push 10,000 tags into a lead's tag list.
11. **PII Scraping**: Attempting a `list` query on `leads` to extract all phone numbers without filtering by `projectId`.
12. **Recursive Loop**: Attempting to update the `updated_at` field with a client-side date instead of `request.time`.

## 3. Test Invariants

- All 12 payloads above **MUST** return `PERMISSION_DENIED`.
- `read` access to `leads` must be restricted to users in the same `projectId` OR admins.
- `delete` operations are strictly forbidden for users on all core business collections.
