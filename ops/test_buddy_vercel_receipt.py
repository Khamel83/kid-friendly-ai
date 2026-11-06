import json
import unittest
from datetime import datetime, timezone
from buddy_vercel_receipt import build_receipt

BASE = {'GITHUB_REPOSITORY': 'Khamel83/kid-friendly-ai', 'GITHUB_SHA': 'a'*40,
        'GITHUB_RUN_ID': '123', 'GITHUB_RUN_ATTEMPT': '2',
        'DEPLOYMENT_STEP_CONCLUSION': 'success', 'DEPLOYMENT_CONFIGURED': 'true'}
NOW = datetime(2026, 11, 3, tzinfo=timezone.utc)
class ReceiptTests(unittest.TestCase):
    def test_configured_success_is_only_workflow_claim(self):
        r=build_receipt(BASE,NOW)
        self.assertTrue(r['deployment_reported_by_workflow'])
        self.assertFalse(r['runtime_acceptance'])
        self.assertFalse(r['remote_release_identity_verified'])
        self.assertFalse(r['endpoint_health_verified'])
        self.assertEqual(r['source_commit'],'a'*40)
        self.assertEqual(r['run_attempt'],2)
    def test_skipped_is_not_deployed(self):
        r=build_receipt(dict(BASE,DEPLOYMENT_STEP_CONCLUSION='skipped'),NOW)
        self.assertFalse(r['deployment_reported_by_workflow'])
    def test_success_without_configured_output_is_not_deployed(self):
        for value in ['', 'false', 'TRUE', ' true ']:
            self.assertFalse(build_receipt(dict(BASE,DEPLOYMENT_CONFIGURED=value),NOW)['deployment_reported_by_workflow'])
    def test_failed_cancelled_missing_unknown_do_not_claim_deployment(self):
        for value in ['failure','cancelled','','unexpected']:
            self.assertFalse(build_receipt(dict(BASE,DEPLOYMENT_STEP_CONCLUSION=value),NOW)['deployment_reported_by_workflow'])
    def test_invalid_identity_refuses(self):
        for key,value in [('GITHUB_REPOSITORY','other/repo'),('GITHUB_SHA','HEAD'),('GITHUB_RUN_ID','../x'),('GITHUB_RUN_ATTEMPT','0')]:
            with self.assertRaises(ValueError):build_receipt(dict(BASE,**{key:value}),NOW)
    def test_secret_and_payload_environment_are_never_read(self):
        accessed=[]
        class Inputs(dict):
            def get(self,key,default=None):accessed.append(key);return super().get(key,default)
        r=build_receipt(Inputs(dict(BASE,VERCEL_TOKEN='DO-NOT-EMIT',PRIVATE_PAYLOAD='DO-NOT-READ')),NOW)
        self.assertNotIn('VERCEL_TOKEN',accessed);self.assertNotIn('PRIVATE_PAYLOAD',accessed)
        self.assertNotIn('DO-NOT-',json.dumps(r))
    def test_deterministic_metadata_without_network_or_provider(self):
        self.assertEqual(build_receipt(BASE,NOW),build_receipt(BASE,NOW))
        self.assertEqual(build_receipt(BASE,NOW)['recorded_at'],NOW.isoformat())
if __name__=='__main__':unittest.main()
