# Entity-Relationship Diagram

Source of truth for the schema is the migration set in `database/migrations/`. This diagram is a
visual companion, kept in sync with it manually — see `docs/PROJECT_BLUEPRINT.md`, Section 5, for
the original design and `docs/PHASE1_DATABASE.md` for the full per-table/per-constraint
explanation.

Renders natively in GitHub and in VS Code with a Mermaid-capable markdown preview extension.

```mermaid
erDiagram
    USERS {
        serial id PK
        varchar name
        varchar email UK
        varchar password_hash
        varchar role
        varchar status
        integer token_version
        timestamptz email_verified_at
        timestamptz created_at
        timestamptz updated_at
    }

    EVENT_CATEGORIES {
        serial id PK
        varchar name UK
        timestamptz created_at
    }

    EVENTS {
        serial id PK
        integer category_id FK
        varchar title
        text description
        varchar location
        timestamptz start_datetime
        timestamptz end_datetime
        integer capacity
        varchar status
        integer created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    EVENT_REGISTRATIONS {
        serial id PK
        integer event_id FK
        integer user_id FK
        varchar status
        timestamptz applied_at
        integer decided_by FK
        timestamptz decided_at
    }

    ATTENDANCE {
        serial id PK
        integer event_registration_id FK_UK
        varchar status
        numeric hours_contributed
        integer marked_by FK
        timestamptz marked_at
    }

    DONATIONS {
        serial id PK
        integer event_id FK
        integer donor_id FK
        varchar donor_name
        numeric amount
        char currency
        varchar payment_method
        boolean is_anonymous
        text notes
        integer recorded_by FK
        timestamptz donated_at
        timestamptz created_at
    }

    CERTIFICATES {
        serial id PK
        integer user_id FK
        integer event_id FK
        varchar certificate_number UK
        timestamptz issued_at
        varchar file_key
    }

    NOTIFICATIONS {
        serial id PK
        integer user_id FK
        varchar type
        text message
        varchar related_entity_type
        integer related_entity_id
        boolean is_read
        timestamptz created_at
    }

    AUDIT_LOGS {
        serial id PK
        integer actor_id FK
        varchar action
        varchar entity_type
        integer entity_id
        jsonb metadata
        timestamptz created_at
    }

    PASSWORD_RESET_TOKENS {
        serial id PK
        integer user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz used_at
    }

    EMAIL_VERIFICATION_TOKENS {
        serial id PK
        integer user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz used_at
    }

    EVENT_CATEGORIES ||--o{ EVENTS : "categorizes"
    USERS ||--o{ EVENTS : "creates (created_by)"
    EVENTS ||--o{ EVENT_REGISTRATIONS : "has"
    USERS ||--o{ EVENT_REGISTRATIONS : "applies (user_id)"
    USERS |o--o{ EVENT_REGISTRATIONS : "decides (decided_by)"
    EVENT_REGISTRATIONS ||--|| ATTENDANCE : "has"
    USERS ||--o{ ATTENDANCE : "marks (marked_by)"
    EVENTS |o--o{ DONATIONS : "receives (optional)"
    USERS |o--o{ DONATIONS : "donates (optional, donor_id)"
    USERS |o--o{ DONATIONS : "records (optional, recorded_by)"
    USERS ||--o{ CERTIFICATES : "earns"
    EVENTS ||--o{ CERTIFICATES : "issued for"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS |o--o{ AUDIT_LOGS : "performs (optional, actor_id)"
    USERS ||--o{ PASSWORD_RESET_TOKENS : "requests"
    USERS ||--o{ EMAIL_VERIFICATION_TOKENS : "requests"
```

## Legend

- `PK` primary key, `FK` foreign key, `UK` unique constraint, `FK_UK` a foreign key that is also unique (enforces a 1:1 relationship).
- `||` = exactly one, `o{` = zero or many, `|o` = zero or one, `||` on both ends of `ATTENDANCE` = exactly one-to-one.
- Full column types, defaults, checks, and cascade rules are in the migration files, not repeated here — this diagram shows structure and relationships only.
