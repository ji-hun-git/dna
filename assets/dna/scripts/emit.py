#!/usr/bin/env python
"""Generate a schema-conforming ingestion event for uploaded health files."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import argparse
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schema" / "ingest-event.schema.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_event(event: Dict[str, Any]) -> None:
    # Lightweight validation to avoid external jsonschema dependency in the MVP.
    required = {"eventId", "kind", "subject", "timestamp", "payload", "producer", "integrity"}
    missing = required - set(event)
    if missing:
        raise ValueError(f"Missing required fields: {sorted(missing)}")

    if not re.match(r"^[a-zA-Z0-9._-]+$", event["eventId"]):
        raise ValueError("eventId must be slug-safe")
    if event["kind"] not in {
        "pdf_upload", "image_upload", "dicom_upload", "csv_upload", "dna_upload",
        "insight_snapshot", "intervention_request"
    }:
        raise ValueError(f"Unsupported kind: {event['kind']}")

    producer = event["producer"]
    for required_key in {"app", "version", "actorId", "environment"}:
        if required_key not in producer:
            raise ValueError(f"producer missing {required_key}")
    if producer["environment"] not in {"prod", "staging", "dev"}:
        raise ValueError("producer.environment must be prod|staging|dev")

    integrity = event["integrity"]
    if not re.match(r"^[A-Fa-f0-9]{64}$", integrity["sha256"]):
        raise ValueError("integrity.sha256 must be a SHA-256 hex string")
    if int(integrity["sizeBytes"]) <= 0:
        raise ValueError("integrity.sizeBytes must be positive")
    if len(integrity["mimeType"]) < 3:
        raise ValueError("integrity.mimeType is required")

    # Schema file existence check only; full contract is enforced in pipeline layer.
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"schema not found: {SCHEMA_PATH}")


def make_event(
    *,
    kind: str,
    actor: str,
    file_path: Path,
    data_category: str,
    retention: str,
    app: str = "dna-health-intel-v1",
    version: str = "0.1.0",
    environment: str = "dev",
    source: str = "manual",
) -> Dict[str, Any]:
    size = file_path.stat().st_size
    digest = sha256_file(file_path)
    now = datetime.now(timezone.utc)
    return {
        "eventId": f"evt_{now.strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:12]}",
        "kind": kind,
        "subject": "user",
        "timestamp": now.isoformat(),
        "payload": {
            "fileName": file_path.name,
            "ingestedAt": now.isoformat(),
        },
        "producer": {
            "app": app,
            "version": version,
            "actorId": actor,
            "environment": environment,
        },
        "integrity": {
            "sha256": digest,
            "sizeBytes": size,
            "mimeType": "application/octet-stream",
        },
        "tags": [kind, data_category.lower()],
        "consent": {
            "dataCategory": data_category,
            "retentionChoice": retention,
            "expiresAt": "2099-12-31T00:00:00+00:00",
        },
        "source": source,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create an ingest-event envelope for uploaded files.")
    parser.add_argument("kind", choices=[
        "pdf_upload", "image_upload", "dicom_upload", "csv_upload", "dna_upload",
        "insight_snapshot", "intervention_request"
    ])
    parser.add_argument("filepath", help="Input file to register")
    parser.add_argument("--actor", default="user-local")
    parser.add_argument("--environment", default="dev", choices=["dev", "staging", "prod"])
    parser.add_argument("--data-category", default="LAB_REPORT")
    parser.add_argument("--retention", default="RETAIN_ENCRYPTED_365_DAYS", choices=[
        "DELETE_AFTER_VERIFICATION", "RETAIN_ENCRYPTED_365_DAYS"
    ])
    parser.add_argument("--app", default="dna-health-intel-v1")
    parser.add_argument("--version", default="0.1.0")
    parser.add_argument("--source", default="manual")
    args = parser.parse_args(argv[1:])

    file_path = Path(args.filepath)

    if not file_path.exists():
        raise FileNotFoundError(f"Input file does not exist: {file_path}")

    event = make_event(
        kind=args.kind,
        actor=args.actor,
        file_path=file_path,
        data_category=args.data_category,
        retention=args.retention,
        app=args.app,
        version=args.version,
        environment=args.environment,
        source=args.source,
    )
    validate_event(event)
    print(json.dumps(event, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
