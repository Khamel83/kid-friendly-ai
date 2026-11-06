#!/usr/bin/env python3
"""Content-free result of the existing Vercel workflow; not independent runtime health."""
import json
import os
import re
from datetime import datetime, timezone

def build_receipt(environ, now=None):
    repository = environ.get('GITHUB_REPOSITORY', '')
    revision = environ.get('GITHUB_SHA', '')
    run_id = environ.get('GITHUB_RUN_ID', '')
    attempt = environ.get('GITHUB_RUN_ATTEMPT', '')
    if repository.lower() != 'khamel83/kid-friendly-ai':
        raise ValueError('unexpected_repository')
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('invalid_revision')
    if not re.fullmatch(r'[1-9][0-9]{0,19}', run_id) or not re.fullmatch(r'[1-9][0-9]{0,5}', attempt):
        raise ValueError('invalid_run_identity')
    conclusion = environ.get('DEPLOYMENT_STEP_CONCLUSION', '')
    if conclusion not in {'success', 'failure', 'cancelled', 'skipped', ''}:
        conclusion = 'unknown'
    confirmed = (conclusion == 'success' and environ.get('DEPLOYMENT_CONFIGURED') == 'true')
    return {
        'schema': 'buddy.vercel-workflow-receipt/v1',
        'repository': 'Khamel83/kid-friendly-ai',
        'source_commit': revision,
        'run_id': run_id,
        'run_attempt': int(attempt),
        'run_url': 'https://github.com/Khamel83/kid-friendly-ai/actions/runs/' + run_id,
        'recorded_at': (now or datetime.now(timezone.utc)).isoformat(),
        'deployment_step_conclusion': conclusion or 'missing',
        'deployment_reported_by_workflow': confirmed,
        'declared_production_url': 'https://kid-friendly-ai.vercel.app',
        'remote_release_identity_verified': False,
        'endpoint_health_verified': False,
        'runtime_acceptance': False,
    }

def main():
    try:
        value = build_receipt(os.environ)
    except ValueError:
        print(json.dumps({'schema': 'buddy.vercel-workflow-receipt/v1', 'result': 'STOP', 'runtime_acceptance': False}))
        return 1
    print(json.dumps(value, sort_keys=True))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
