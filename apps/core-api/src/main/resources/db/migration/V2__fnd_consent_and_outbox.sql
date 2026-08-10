create table consent_grant (
    consent_id uuid primary key,
    subject_id varchar(128) not null,
    subject_digest char(72) not null,
    purpose varchar(64) not null,
    sources jsonb not null,
    data_categories jsonb not null,
    operations jsonb not null,
    recipients jsonb not null,
    region char(2) not null check (region = 'KR'),
    processor_set_version varchar(32) not null,
    notice_version varchar(64) not null,
    granted_at timestamptz not null,
    expires_at timestamptz null,
    revoked_at timestamptz null,
    signature_receipt char(71) not null,
    check (jsonb_array_length(sources) > 0),
    check (jsonb_array_length(data_categories) > 0),
    check (jsonb_array_length(operations) > 0)
);
create index consent_grant_subject_idx on consent_grant(subject_id, granted_at desc);
create index consent_grant_subject_digest_idx on consent_grant(subject_digest);

create table platform_outbox (
    event_id uuid primary key,
    event_type varchar(80) not null,
    aggregate_id uuid not null,
    payload jsonb not null,
    occurred_at timestamptz not null,
    published_at timestamptz null,
    attempts integer not null default 0 check (attempts >= 0)
);
create index platform_outbox_unpublished_idx on platform_outbox(occurred_at) where published_at is null;
