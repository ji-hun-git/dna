create table security_audit_event (
    sequence bigint generated always as identity primary key,
    event_id uuid not null unique,
    event_type varchar(64) not null,
    actor_digest char(72) not null,
    resource_digest char(72) null,
    purpose varchar(64) null,
    outcome varchar(16) not null,
    correlation_id uuid not null,
    occurred_at timestamptz not null,
    previous_hash char(64) not null,
    event_hash char(64) not null unique
);

create function reject_security_audit_mutation() returns trigger language plpgsql as $$
begin
    raise exception 'security audit rows are append-only';
end;
$$;

create trigger security_audit_no_update_delete
before update or delete on security_audit_event
for each row execute function reject_security_audit_mutation();
